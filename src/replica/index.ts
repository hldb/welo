import { EventEmitter, CustomEvent } from '@libp2p/interfaces/events'
import { CID } from 'multiformats/cid'
import { Key } from 'interface-datastore'
import { equals } from 'uint8arrays/equals'
import { start, stop } from '@libp2p/interfaces/startable'
import all from 'it-all'
import PQueue from 'p-queue'
import { LevelBlockstore } from 'blockstore-level'
import type { BlockView } from 'multiformats/interface'
import type { LevelDatastore } from 'datastore-level'

import { Playable } from '@/utils/playable.js'
import { decodedcid, encodedcid, parsedcid } from '@/utils/index.js'
import { DatastoreClass, getDatastore } from '@/utils/datastore.js'
import { Blocks } from '@/blocks/index.js'
import type { IdentityInstance, IdentityStatic } from '@/identity/interface.js'
import type { EntryInstance, EntryStatic } from '@/entry/interface.js'
import type { Manifest } from '@/manifest/index.js'
import type { AccessInstance } from '@/access/interface.js'

import { Graph, GraphRoot } from './graph.js'
import {
  loadEntry,
  graphLinks,
  sortEntries,
  sortEntriesRev,
  traverser
} from './traversal.js'
import type { Edge } from './graph-node.js'
import type { IpldDatastore } from '@/utils/paily.js'
import type { ShardLink } from '@alanshaw/pail/src/shard.js'

const rootHashKey = new Key('rootHash')

interface ReplicaEvents {
  write: CustomEvent<undefined>
  update: CustomEvent<undefined>
}

export class Replica extends Playable {
  readonly manifest: Manifest
  readonly directory: string
  readonly blocks: Blocks
  readonly identity: IdentityInstance<any>
  readonly access: AccessInstance
  readonly Entry: EntryStatic<any>
  readonly Identity: IdentityStatic<any>
  readonly events: EventEmitter<ReplicaEvents>

  Datastore: DatastoreClass

  #storage: LevelDatastore | null
  #blockstore: LevelBlockstore | null
  #graph: Graph | null
  _queue: PQueue

  hash: CID | null

  constructor ({
    manifest,
    directory,
    Datastore,
    blocks,
    access,
    identity,
    Entry,
    Identity
  }: {
    manifest: Manifest
    directory: string
    Datastore: DatastoreClass
    blocks: Blocks
    identity: IdentityInstance<any>
    access: AccessInstance
    Entry: EntryStatic<any>
    Identity: IdentityStatic<any>
  }) {
    const starting = async (): Promise<void> => {
      this.#storage = await getDatastore(this.Datastore, directory)
      this.#blockstore = new LevelBlockstore(directory + '/blocks')

      await this.#storage.open()
      await this.#blockstore.open()
      const root: BlockView<GraphRoot> | null = await getRoot(
        this.#storage,
        this.#blockstore
      ).catch(() => null)

      this.#graph = new Graph(this.#blockstore, root?.value)
      this.hash = root?.cid

      await start(this.#graph)
    }
    const stopping = async (): Promise<void> => {
      await this._queue.onIdle()
      this.#storage !== null && await this.#storage.close()
      this.#blockstore !== null && await this.#blockstore.close()
      await stop(this.#graph)

      this.#storage = null
      this.#blockstore = null
      this.#graph = null
    }

    super({ starting, stopping })

    this.manifest = manifest
    this.directory = directory
    this.blocks = blocks
    this.access = access
    this.identity = identity
    this.Entry = Entry
    this.Identity = Identity

    this.Datastore = Datastore

    this.#storage = null
    this.#blockstore = null
    this.#graph = null
    this._queue = new PQueue({})

    this.events = new EventEmitter()
  }

  get graph (): Graph {
    if (this.#graph == null) {
      throw new Error('Cannot read graph before replica is started')
    }

    return this.#graph
  }

  get heads (): IpldDatastore<ShardLink> {
    return this.graph.heads
  }

  get tails (): IpldDatastore<ShardLink> {
    return this.graph.tails
  }

  get missing (): IpldDatastore<ShardLink> {
    return this.graph.missing
  }

  get denied (): IpldDatastore<ShardLink> {
    return this.graph.denied
  }

  async traverse (
    { direction }: { direction: 'descend' | 'ascend' } = {
      direction: 'descend'
    }
  ): Promise<Array<EntryInstance<any>>> {
    const blocks = this.blocks
    const Entry = this.Entry
    const Identity = this.Identity

    const graph = this.graph.clone()

    const headsAndTails = [graph.heads, graph.tails]

    let edge: Edge, orderFn: typeof sortEntries | typeof sortEntriesRev
    if (direction === 'descend') {
      edge = 'out'
      orderFn = sortEntries
    } else if (direction === 'ascend') {
      // heads and tails are switched if traversal is ascending
      headsAndTails.reverse()
      edge = 'in'
      orderFn = sortEntriesRev
    } else {
      throw new Error('unknown direction given')
    }
    // todo: less wordy way to assign heads and tails from direction
    const [heads, tails] = headsAndTails

    const cids = (await all(heads.queryKeys({}))).map(key => parsedcid(key.toString()))
    const load = loadEntry({ blocks, Entry, Identity })
    const links = graphLinks({ graph, tails, edge })

    return await traverser({ cids, load, links, orderFn })
  }

  async has (cid: CID | string): Promise<boolean> {
    if (!this.isStarted()) {
      throw new Error('replica not started')
    }

    return await this.graph.has(cid)
  }

  async known (cid: CID | string): Promise<boolean> {
    if (!this.isStarted()) {
      throw new Error('replica not started')
    }

    return await this.graph.known(cid)
  }

  async add (entries: Array<EntryInstance<any>>): Promise<void> {
    if (this.#storage == null || this.#blockstore == null) {
      throw new Error('replica not started')
    }

    const clone = this.graph.clone()

    for await (const entry of entries) {
      if (!equals(entry.tag, this.manifest.getTag())) {
        console.warn('replica received entry with mismatched tag')
        continue
      }

      await this.blocks.put(entry.block)
      await this.blocks.put(entry.identity.block)

      if (await this.access.canAppend(entry)) {
        await this.graph.add(entry.cid, entry.next)
      } else {
        await this.graph.deny(entry.cid)
      }
    }

    if (!this.graph.equals(clone)) {
      const block = await encodeRoot(this.graph.root)
      await setRoot(this.#storage, this.#blockstore, block)
      this.hash = block.cid
      this.events.dispatchEvent(new CustomEvent<undefined>('update'))
    }
  }

  async write (payload: any): Promise<EntryInstance<any>> {
    if (!this.isStarted()) {
      throw new Error('replica not started')
    }

    const entry = await this.Entry.create({
      identity: this.identity,
      tag: this.manifest.getTag(),
      payload,
      next: (await all(this.heads.queryKeys({}))).map((key) => CID.parse(key.toString())),
      refs: [] // refs are empty for now
    })

    await this.blocks.put(entry.block)

    return await this.add([entry]).then(() => {
      this.events.dispatchEvent(new CustomEvent<undefined>('write'))
      return entry
    })
  }

  // useful when the access list is updated
  // async deny (entries) {
  //   for await (const entry of entries) {
  //
  //   }
  // }
}

const encodeRoot = async (root: GraphRoot): Promise<BlockView<GraphRoot>> => await Blocks.encode({ value: root })

const getRoot = async (
  datastore: LevelDatastore,
  blockstore: LevelBlockstore
): Promise<BlockView<GraphRoot>> => {
  try {
    const rootHash = await datastore.get(rootHashKey)
    const bytes = await blockstore.get(decodedcid(rootHash))
    return await Blocks.decode<GraphRoot>({ bytes })
  } catch (e) {
    throw new Error('failed to get root')
  }
}

const setRoot = async (
  datastore: LevelDatastore,
  blockstore: LevelBlockstore,
  block: BlockView<GraphRoot>
): Promise<void> => {
  try {
    await Promise.all([
      blockstore.put(block.cid, block.bytes),
      datastore.put(rootHashKey, encodedcid(block.cid))
    ])
  } catch (e) {
    throw new Error('failed to get root')
  }
}
