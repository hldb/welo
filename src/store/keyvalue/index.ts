import EventEmitter from 'events'
import { HashMap } from 'ipld-hashmap'
import { Datastore, Key } from 'interface-datastore'

import { Replica } from '~database/replica.js'
import { Extends } from '~utils/decorators.js'
import { ManifestData, ManifestInstance } from '~manifest/interface.js'
import { Playable } from '~utils/playable.js'
import { getStorage } from '~storage/index.js'
import { loadHashMap } from '~database/graph.js'
import { Blocks } from '~blocks/index.js'
import { decodedcid, encodedcid } from '~utils/index.js'

import protocol, { Config } from './protocol.js'
import { creators, selectors, reducer } from './model.js'
import { StoreStatic, StoreInstance } from '../interface.js'

const indexesKey = new Key('indexes')

@Extends<StoreStatic>()
export class Keyvalue extends Playable implements StoreInstance {
  static get protocol (): string {
    return protocol
  }

  get selectors (): typeof selectors {
    return selectors
  }

  get creators (): typeof creators {
    return creators
  }

  readonly manifest: ManifestInstance<ManifestData>
  readonly blocks: Blocks
  readonly config?: Config
  readonly replica: Replica
  readonly Storage: getStorage
  private _storage: Datastore | null
  private _indexes: HashMap<any> | null
  private _index: HashMap<any> | null
  events: EventEmitter

  constructor ({
    manifest,
    blocks,
    replica,
    Storage
  }: {
    manifest: ManifestInstance<ManifestData>
    blocks: Blocks
    replica: Replica
    Storage: getStorage
  }) {
    const starting = async (): Promise<void> => {
      this._storage = await Storage('store')
      await this._storage.open()

      const indexesCID = await this.storage.get(indexesKey).catch(() => undefined)
      this._indexes = await loadHashMap(blocks, indexesCID === undefined ? undefined : decodedcid(indexesCID))

      const indexCID = await this.indexes.get('latest')
      this._index = await loadHashMap(blocks, indexCID === undefined ? undefined : decodedcid(indexCID))

      // replica.events.on('update', (): void => { void this.latest() })
    }
    const stopping = async (): Promise<void> => {
      await this.storage.close()

      this._storage = null
      this._indexes = null
      this._index = null
    }
    super({ starting, stopping })

    this.manifest = manifest
    this.blocks = blocks
    this.config = manifest.store.config
    this.replica = replica

    this.Storage = Storage
    this._storage = null
    this._indexes = null
    this._index = null

    this.events = new EventEmitter()
  }

  get storage (): Datastore {
    if (this._storage === null) {
      throw new Error()
    }

    return this._storage
  }

  get indexes (): HashMap<any> {
    if (this._indexes === null) {
      throw new Error()
    }

    return this._indexes
  }

  get index (): HashMap<any> {
    if (this._index === null) {
      throw new Error()
    }

    return this._index
  }

  // will return the latest reduced state to hand to selectors
  async latest (): Promise<HashMap<any>> {
    const index = await loadHashMap(this.blocks)
    for await (const entry of await this.replica.traverse()) {
      await reducer(index, entry)
    }
    await this.indexes.set('latest', encodedcid(index.cid))
    await this.storage.put(indexesKey, encodedcid(this.indexes.cid))
    this._index = index
    return index
  }
}
