import EventEmitter from 'events'
import { CID } from 'multiformats/cid'
import { equals } from 'uint8arrays/equals'
import { start, stop } from '@libp2p/interfaces/startable'

import { Blocks } from '../mods/blocks.js'
import { Graph } from './graph.js'
import { Edge } from './graph-node.js'
import { IdentityInstance, IdentityStatic } from '../identity/interface.js'
import { EntryInstance, EntryStatic } from '../entry/interface.js'
import { ManifestInstance } from '../manifest/interface.js'
import { AccessInstance } from '../access/interface.js'
import { Playable } from '../utils/playable.js'
import {
  loadEntry,
  graphLinks,
  sortEntries,
  sortEntriesRev,
  traverser
} from './traversal.js'
import { StorageFunc, StorageReturn } from '../mods/storage.js'
import all from 'it-all'
import { parsedcid } from '../utils/index.js'

export class Replica extends Playable {
  readonly manifest: ManifestInstance<any>
  readonly blocks: Blocks
  readonly identity: IdentityInstance<any>
  readonly access: AccessInstance
  readonly Entry: EntryStatic<any>
  readonly Identity: IdentityStatic<any>
  readonly events: EventEmitter

  Storage: StorageFunc

  _storage: StorageReturn | null
  _graph: Graph | null

  constructor ({
    manifest,
    Storage,
    blocks,
    access,
    identity,
    Entry,
    Identity
  }: {
    manifest: ManifestInstance<any>
    Storage: StorageFunc
    blocks: Blocks
    identity: IdentityInstance<any>
    access: AccessInstance
    Entry: EntryStatic<any>
    Identity: IdentityStatic<any>
  }) {
    const starting = async (): Promise<void> => {
      this._storage = await this.Storage('replica')
      await this._storage.open()

      // const rootHash = await this._storage.get()
      // const root = {}

      this._graph = new Graph({ blocks, root: undefined })
      await start(this._graph)
    }
    const stopping = async (): Promise<void> => {
      await stop(this._graph)
      await this.storage.close()

      this._storage = null
      this._graph = null
    }
    super({ starting, stopping })

    this.manifest = manifest
    this.blocks = blocks
    this.access = access
    this.identity = identity
    this.Entry = Entry
    this.Identity = Identity

    this.Storage = Storage

    this._storage = null
    this._graph = null

    this.events = new EventEmitter()
  }

  private get storage (): StorageReturn {
    if (!this.isStarted()) {
      throw new Error()
    }

    return this._storage as StorageReturn
  }

  private get graph (): Graph {
    if (!this.isStarted()) {
      throw new Error()
    }

    return this._graph as Graph
  }

  get heads (): typeof this.graph.heads {
    return this.graph.heads
  }

  get tails (): typeof this.graph.tails {
    return this.graph.tails
  }

  get missing (): typeof this.graph.missing {
    return this.graph.missing
  }

  get denied (): typeof this.graph.denied {
    return this.graph.denied
  }

  get size (): typeof this.graph.size {
    return this.graph.size.bind(this.graph)
  }

  async traverse (
    { direction } = { direction: 'descend' }
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
    for await (const entry of entries) {
      if (!equals(entry.tag, this.manifest.getTag)) {
        console.warn('replica received entry with mismatched tag')
        continue
      }

      await this.blocks.put(entry.block)

      if (await this.access.canAppend(entry)) {
        await this.graph.add(entry.cid, entry.next)
      } else {
        await this.graph.deny(entry.cid)
      }
    }
    this.events.emit('update')
  }

  async write (payload: any): Promise<EntryInstance<any>> {
    const entry = await this.Entry.create({
      identity: this.identity,
      tag: this.manifest.getTag,
      payload,
      next: (await all(this.heads.keys())).map(string => CID.parse(string)),
      refs: [] // refs are empty for now
    })

    await this.blocks.put(entry.block)

    // do not await
    const add = await this.add([entry]).then(() => {
      this.events.emit('write')
      return entry
    })

    return add
  }

  // useful when the access list is updated
  // async deny (entries) {
  //   for await (const entry of entries) {
  //
  //   }
  // }
}
