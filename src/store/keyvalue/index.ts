import { EventEmitter, CustomEvent } from '@libp2p/interfaces/events'
import { Key } from 'interface-datastore'
import { NamespaceDatastore } from 'datastore-core'
import type { HashMap } from 'ipld-hashmap'
import type { Datastore } from 'interface-datastore'

import { Playable } from '@/utils/playable.js'
import { loadHashMap } from '@/replica/graph.js'
import { decodedcid, encodedcid } from '@/utils/index.js'
import type { Replica } from '@/replica/index.js'
import type { Blocks } from '@/blocks/index.js'
import type { Manifest } from '@/manifest/index.js'

import protocol, { Config } from './protocol.js'
import { creators, selectors, reducer } from './model.js'
import type { StoreModule, StoreInstance, Events, Props } from '../interface.js'

const indexesKey = new Key('indexes')

export class Keyvalue extends Playable implements StoreInstance {
  get selectors (): typeof selectors {
    return selectors
  }

  get creators (): typeof creators {
    return creators
  }

  readonly manifest: Manifest
  readonly directory: string
  readonly blocks: Blocks
  readonly config?: Config
  readonly replica: Replica
  readonly Datastore: Datastore
  private _storage: Datastore | null
  private _indexes: HashMap<any> | null
  private _index: HashMap<any> | null
  events: EventEmitter<Events>

  constructor ({
    manifest,
    directory,
    blocks,
    replica,
    Datastore
  }: Props) {
    const starting = async (): Promise<void> => {
      this._storage = new NamespaceDatastore(Datastore, new Key(directory))

      let indexesCID: Uint8Array | undefined = undefined

      try {
        indexesCID = await this.storage.get(indexesKey)
      } catch (error) {}

      this._indexes = await loadHashMap(
        blocks,
        indexesCID === undefined ? undefined : decodedcid(indexesCID)
      )

      const indexCID = await this.indexes.get('latest')
      this._index = await loadHashMap(
        blocks,
        indexCID === undefined ? undefined : decodedcid(indexCID)
      )

      // replica.events.on('update', (): void => { void this.latest() })
    }
    const stopping = async (): Promise<void> => {
      this._storage = null
      this._indexes = null
      this._index = null
    }
    super({ starting, stopping })

    this.manifest = manifest
    this.directory = directory
    this.blocks = blocks
    this.config = manifest.store.config as Config
    this.replica = replica

    this.Datastore = Datastore
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
    this.events.dispatchEvent(new CustomEvent<undefined>('update'))
    return index
  }
}

export const createKeyValueStore: () => StoreModule<Keyvalue, typeof protocol> = () => ({
  protocol,
  create: (props: Props) => new Keyvalue(props)
})
