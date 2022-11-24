import EventEmitter from 'events'
import { CID } from 'multiformats/cid'
import { Block } from 'multiformats/block'
import { Datastore, Key } from 'interface-datastore'
import { equals } from 'uint8arrays/equals'
import { start, stop } from '@libp2p/interfaces/startable'
import all from 'it-all'

import { Blocks } from '~blocks/index.js'
import { IdentityInstance, IdentityStatic } from '~identity/interface.js'
import { EntryInstance, EntryStatic } from '~entry/interface.js'
import { ManifestInstance } from '~manifest/interface.js'
import { AccessInstance } from '~access/interface.js'
import { Playable } from '~utils/playable.js'
import { getStorage } from '~storage/index.js'
import { decodedcid, encodedcid, parsedcid } from '~utils/index.js'

import { Graph, Root } from './graph.js'
import { Edge } from './graph-node.js'
import {
  loadEntry,
  graphLinks,
  sortEntries,
  sortEntriesRev,
  traverser
} from './traversal.js'

const rootHashKey = new Key('rootHash')

export class Replica extends Playable {
  readonly manifest: ManifestInstance<any>
  readonly blocks: Blocks
  readonly identity: IdentityInstance<any>
  readonly access: AccessInstance
  readonly Entry: EntryStatic<any>
  readonly Identity: IdentityStatic<any>
  readonly events: EventEmitter

  Storage: getStorage

  _storage: Datastore | null
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
    Storage: getStorage
    blocks: Blocks
    identity: IdentityInstance<any>
    access: AccessInstance
    Entry: EntryStatic<any>
    Identity: IdentityStatic<any>
  }) {
    const onUpdate = (): void => {
      void this.setRoot(this.graph.root)
    }
    const starting = async (): Promise<void> => {
      this._storage = await this.Storage('replica')
      await this._storage.open()

      const root: Root | undefined = await this.getRoot().catch(() => undefined)

      this._graph = new Graph({ blocks, root })

      this.events.on('update', onUpdate)
      await start(this._graph)
    }
    const stopping = async (): Promise<void> => {
      await stop(this._graph)
      this.events.removeListener('update', onUpdate)
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

  get storage (): Datastore {
    if (this._storage === null) {
      throw new Error()
    }

    return this._storage
  }

  get graph (): Graph {
    if (this._graph === null) {
      throw new Error()
    }

    return this._graph
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

  async getRoot (): Promise<Root> {
    try {
      const rootHash = await this.storage.get(rootHashKey)
      const block: Block<Root> = await this.blocks.get(decodedcid(rootHash))
      return block.value
    } catch (e) {
      throw new Error('failed to get root')
    }
  }

  async setRoot (root: Root): Promise<void> {
    try {
      const block = await this.blocks.encode({ value: root })
      await this.blocks.put(block)
      await this._storage?.put(rootHashKey, encodedcid(block.cid))
    } catch (e) {
      throw new Error('failed to set root')
    }
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
      next: (await all(this.heads.keys())).map((string) => CID.parse(string)),
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
