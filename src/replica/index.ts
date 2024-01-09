import { EventEmitter, CustomEvent } from '@libp2p/interfaces/events'
import { start, stop } from '@libp2p/interfaces/startable'
import { Key } from 'interface-datastore'
import all from 'it-all'
import { CID } from 'multiformats/cid'
import PQueue from 'p-queue'
import { equals } from 'uint8arrays/equals'
import { type GraphRoot, Graph } from './graph.js'
import {
  loadEntry,
  graphLinks,
  sortEntries,
  sortEntriesRev,
  traverser
} from './traversal.js'
import type { Edge } from './graph-node.js'
import type { AccessInstance } from '@/access/interface.js'
import type { EntryInstance } from '@/entry/interface.js'
import type { IdentityInstance } from '@/identity/interface.js'
import type { DbComponents } from '@/interface.js'
import type { Manifest } from '@/manifest/index.js'
import type { Paily } from '@/utils/paily.js'
import type { Blockstore } from 'interface-blockstore'
import type { Datastore } from 'interface-datastore'
import type { BlockView } from 'multiformats/interface'
import { decodeCbor, encodeCbor } from '@/utils/block.js'
import { decodedcid, encodedcid, parsedcid } from '@/utils/index.js'
import { Playable } from '@/utils/playable.js'

const rootHashKey = new Key('rootHash')

export interface ReplicaEvents {
  write: CustomEvent<EntryInstance<any>>
  update: CustomEvent<undefined>
}

export class Replica extends Playable {
  readonly manifest: Manifest
  readonly identity: IdentityInstance<any>
  readonly access: AccessInstance
  readonly events: EventEmitter<ReplicaEvents>
  readonly components: Pick<DbComponents, 'entry' | 'identity'>

  #datastore: Datastore
  blockstore: Blockstore
  #graph: Graph | null

  _queue: PQueue

  root: CID | null

  constructor ({
    manifest,
    datastore,
    blockstore,
    access,
    identity,
    components
  }: {
    manifest: Manifest
    datastore: Datastore
    blockstore: Blockstore
    identity: IdentityInstance<any>
    access: AccessInstance
    components: Pick<DbComponents, 'entry' | 'identity'>
  }) {
    const starting = async (): Promise<void> => {
      const root: BlockView<GraphRoot> | null = await getRoot(
        this.#datastore,
        this.blockstore
      ).catch(() => null)

      this.#graph = new Graph(this.blockstore, root?.value)
      await start(this.#graph)

      if (root?.cid == null) {
        await this.#updateRoot()
      } else {
        this.root = root.cid
      }
    }
    const stopping = async (): Promise<void> => {
      await this._queue.onIdle()
      await stop(this.#graph)
      this.#graph = null
    }

    super({ starting, stopping })

    this.manifest = manifest
    this.access = access
    this.identity = identity
    this.components = components

    this.#datastore = datastore
    this.blockstore = blockstore
    this.#graph = null
    this._queue = new PQueue({})

    this.root = null

    this.events = new EventEmitter()
  }

  get graph (): Graph {
    if (this.#graph == null) {
      throw new Error('Cannot read graph before replica is started')
    }

    return this.#graph
  }

  get heads (): Paily {
    return this.graph.heads
  }

  get tails (): Paily {
    return this.graph.tails
  }

  get missing (): Paily {
    return this.graph.missing
  }

  get denied (): Paily {
    return this.graph.denied
  }

  async traverse (
    { direction }: { direction: 'descend' | 'ascend' } = {
      direction: 'descend'
    }
  ): Promise<Array<EntryInstance<any>>> {
    const blockstore = this.blockstore
    const entry = this.components.entry
    const identity = this.components.identity

    const graph = this.graph.clone()
    await start(graph)

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
    const [heads, tails] = headsAndTails

    const cids = (await all(heads.queryKeys({}))).map(key => parsedcid(key.baseNamespace()))
    const load = loadEntry({ blockstore, entry, identity })
    const links = graphLinks({ graph, tails, edge })

    return traverser({ cids, load, links, orderFn })
  }

  async has (cid: CID | string): Promise<boolean> {
    if (!this.isStarted()) {
      throw new Error('replica not started')
    }

    return this.graph.has(cid)
  }

  async known (cid: CID | string): Promise<boolean> {
    if (!this.isStarted()) {
      throw new Error('replica not started')
    }

    return this.graph.known(cid)
  }

  async add (entries: Array<EntryInstance<any>>): Promise<void> {
    if (this.#datastore == null || this.blockstore == null) {
      throw new Error('replica not started')
    }

    const clone = this.graph.clone()

    for await (const entry of entries) {
      if (!equals(entry.tag, this.manifest.getTag())) {
        // eslint-disable-next-line no-console
        console.warn('replica received entry with mismatched tag')
        continue
      }

      await this.blockstore.put(entry.cid, entry.block.bytes)
      await this.blockstore.put(entry.identity.auth, entry.identity.block.bytes)

      if (await this.access.canAppend(entry)) {
        await this.graph.add(entry.cid, entry.next)
      } else {
        await this.graph.deny(entry.cid)
      }
    }

    if (!this.graph.equals(clone)) {
      await this.#updateRoot()
    }
  }

  async write (payload: any): Promise<EntryInstance<any>> {
    if (!this.isStarted()) {
      throw new Error('replica not started')
    }

    const entry = await this.components.entry.create({
      identity: this.identity,
      tag: this.manifest.getTag(),
      payload,
      next: (await all(this.heads.queryKeys({}))).map((key) => CID.parse(key.baseNamespace())),
      refs: [] // refs are empty for now
    })

    await this.blockstore.put(entry.cid, entry.block.bytes)

    return this.add([entry]).then(() => {
      this.events.dispatchEvent(new CustomEvent<EntryInstance<any>>('write', { detail: entry }))
      return entry
    })
  }

  async writes (payloads: any[]): Promise<Array<EntryInstance<any>>> {
    if (!this.isStarted()) {
      throw new Error('replica not started')
    }

    const entries: Array<EntryInstance<any>> = []
    let head: EntryInstance<any> | null = null
    for (const payload of payloads) {
      const entry: EntryInstance<any> = await this.components.entry.create({
        identity: this.identity,
        tag: this.manifest.getTag(),
        payload,
        next: head != null ? [head.cid] : [],
        refs: [] // refs are empty for now
      })
      entries.push(entry)
      head = entry
    }

    await this.add(entries)

    return entries
  }

  async newEntry (payload: any): Promise<EntryInstance<any>> {
    if (!this.isStarted()) {
      throw new Error('replica not started')
    }

    const entry = await this.components.entry.create({
      identity: this.identity,
      tag: this.manifest.getTag(),
      payload,
      next: (await all(this.heads.queryKeys({}))).map((key) => CID.parse(key.baseNamespace())),
      refs: [] // refs are empty for now
    })

    return entry
  }

  // useful when the access list is updated
  // async deny (entries) {
  //   for await (const entry of entries) {
  //
  //   }
  // }

  async #updateRoot (): Promise<void> {
    const block = await encodeRoot(this.graph.root)
    await setRoot(this.#datastore, this.blockstore, block)
    this.root = block.cid
    this.events.dispatchEvent(new CustomEvent<undefined>('update'))
  }
}

const encodeRoot = async (root: GraphRoot): Promise<BlockView<GraphRoot>> => encodeCbor<GraphRoot>(root)

const getRoot = async (
  datastore: Datastore,
  blockstore: Blockstore
): Promise<BlockView<GraphRoot>> => {
  try {
    const rootHash = await datastore.get(rootHashKey)
    const bytes = await blockstore.get(decodedcid(rootHash))
    return await decodeCbor<GraphRoot>(bytes)
  } catch (e) {
    throw new Error('failed to get root')
  }
}

const setRoot = async (
  datastore: Datastore,
  blockstore: Blockstore,
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
