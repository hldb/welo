import { EventEmitter, CustomEvent } from '@libp2p/interfaces/events'
import { CID } from 'multiformats/cid'
import { Key } from 'interface-datastore'
import { equals } from 'uint8arrays/equals'
import { start, stop } from '@libp2p/interfaces/startable'
import all from 'it-all'
import PQueue from 'p-queue'
import type { Datastore } from 'interface-datastore'
import type { BlockView } from 'multiformats/interface'
import type { HashMap } from 'ipld-hashmap/interface'

import { Playable } from '@/utils/playable.js'
import { decodedcid, encodedcid, parsedcid } from '@/utils/index.js'
import type { Blocks } from '@/blocks/index.js'
import type { IdentityInstance, IdentityModule } from '@/identity/interface.js'
import type { EntryInstance, EntryModule } from '@/entry/interface.js'
import type { Manifest } from '@/manifest/index.js'
import type { AccessInstance } from '@/access/interface.js'

import { Graph, Root } from './graph.js'
import {
  loadEntry,
  graphLinks,
  sortEntries,
  sortEntriesRev,
  traverser
} from './traversal.js'
import type { Edge } from './graph-node.js'

const rootHashKey = new Key('rootHash')

interface ReplicaEvents {
  write: CustomEvent<undefined>
  update: CustomEvent<undefined>
}

export class Replica extends Playable {
  readonly manifest: Manifest
  readonly blocks: Blocks
  readonly identity: IdentityInstance<any>
  readonly access: AccessInstance
  readonly Entry: EntryModule<any>
  readonly Identity: IdentityModule<any>
  readonly events: EventEmitter<ReplicaEvents>

  Datastore: Datastore

  _graph: Graph | null
  _queue: PQueue

  constructor ({
    manifest,
    Datastore,
    blocks,
    access,
    identity,
    Entry,
    Identity
  }: {
    manifest: Manifest
    Datastore: Datastore
    blocks: Blocks
    identity: IdentityInstance<any>
    access: AccessInstance
    Entry: EntryModule
    Identity: IdentityModule
  }) {
    const onUpdate = (): void => {
      void this._queue.add(async () => await this.setRoot(this.graph.root))
    }
    const starting = async (): Promise<void> => {
      const root: Root | undefined = await this.getRoot().catch(() => undefined)

      this._graph = new Graph({ blocks, root })

      this.events.addEventListener('update', onUpdate)
      await start(this._graph)
    }
    const stopping = async (): Promise<void> => {
      this.events.removeEventListener('update', onUpdate)
      await this._queue.onIdle()
      await stop(this._graph)
      this._graph = null
    }

    super({ starting, stopping })

    this.manifest = manifest
    this.blocks = blocks
    this.access = access
    this.identity = identity
    this.Entry = Entry
    this.Identity = Identity

    this.Datastore = Datastore
    this._graph = null
    this._queue = new PQueue({})

    this.events = new EventEmitter()
  }

  get storage (): Datastore {
    return this.Datastore
  }

  get graph (): Graph {
    if (this._graph === null) {
      throw new Error('graph has not been set yet')
    }

    return this._graph
  }

  get heads (): HashMap<null> {
    return this.graph.heads
  }

  get tails (): HashMap<null> {
    return this.graph.tails
  }

  get missing (): HashMap<null> {
    return this.graph.missing
  }

  get denied (): HashMap<null> {
    return this.graph.denied
  }

  get size (): () => Promise<number> {
    return this.graph.size.bind(this.graph)
  }

  async getRoot (): Promise<Root> {
    try {
      const rootHash = await this.storage.get(rootHashKey)
      const block: BlockView<Root> = await this.blocks.get<Root>(
        decodedcid(rootHash)
      )
      return block.value
    } catch (e) {
      throw new Error('failed to get root')
    }
  }

  async setRoot (root: Root): Promise<void> {
    try {
      const block = await this.blocks.encode({ value: root })
      await this.blocks.put(block)
      await this.Datastore.put(rootHashKey, encodedcid(block.cid))
    } catch (e) {
      throw new Error('failed to set root')
    }
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
    // todo: less wordy way to assign heads and tails from direction
    const [heads, tails] = headsAndTails

    const cids = (await all(heads.keys())).map(parsedcid)
    const load = loadEntry({ blocks, Entry, Identity })
    const links = graphLinks({ graph, tails, edge })

    return await traverser({ cids, load, links, orderFn })
  }

  async has (cid: CID | string): Promise<boolean> {
    return await this.graph.has(cid)
  }

  async known (cid: CID | string): Promise<boolean> {
    return await this.graph.known(cid)
  }

  async add (entries: Array<EntryInstance<any>>): Promise<void> {
    const size = await this.graph.size()
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

    if ((await this.graph.size()) - size > 0) {
      this.events.dispatchEvent(new CustomEvent<undefined>('update'))
    }
  }

  async write (payload: any): Promise<EntryInstance<any>> {
    const entry = await this.Entry.create({
      identity: this.identity,
      tag: this.manifest.getTag(),
      payload,
      next: (await all(this.heads.keys())).map((string) => CID.parse(string)),
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
