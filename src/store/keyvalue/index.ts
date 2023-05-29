import { EventEmitter, CustomEvent } from '@libp2p/interfaces/events'
import { Key } from 'interface-datastore'
import type { LevelDatastore } from 'datastore-level'

import { Extends } from '@/utils/decorators.js'
import { Playable } from '@/utils/playable.js'
import { loadHashMap } from '@/replica/graph.js'
import { decodedcid, encodedcid } from '@/utils/index.js'
import { DatastoreClass, getDatastore } from '@/utils/datastore.js'
import { Blocks } from '@/blocks/index.js'
import { CodeError } from '@libp2p/interfaces/errors'
import type { Replica } from '@/replica/index.js'
import type { Manifest } from '@/manifest/index.js'

import protocol, { Config } from './protocol.js'
import { creators, selectors, reducer } from './model.js'
import type { StoreStatic, StoreInstance, Events } from '../interface.js'
import type { IpldDatastore } from '@/utils/paily.js'
import type { AnyLink } from '@alanshaw/pail/link'

interface PersistedRoot {
  index: AnyLink
  replica: AnyLink
}

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

  readonly manifest: Manifest
  readonly directory: string
  readonly blocks: Blocks
  readonly config?: Config
  readonly replica: Replica
  readonly Datastore: DatastoreClass
  private _storage: LevelDatastore | null
  private _index: IpldDatastore | null
  events: EventEmitter<Events>

  constructor ({
    manifest,
    directory,
    blocks,
    replica,
    Datastore
  }: {
    manifest: Manifest
    directory: string
    blocks: Blocks
    replica: Replica
    Datastore: DatastoreClass
  }) {
    const starting = async (): Promise<void> => {
      this._storage = await getDatastore(Datastore, directory)
      await this._storage.open()

      const bytes = await this._storage.get(new Key('latest'))
        .catch((e) => {
          if (e instanceof CodeError && e.code === 'ERR_NOT_FOUND') {
            return { }
          }

          throw e
        })

      if (bytes) {
        const block = await Blocks.decode<PersistedRoot>({ bytes })
      } else {

      }

      this._index = await loadHashMap(
        blocks,
        indexCID === undefined ? undefined : decodedcid(indexCID)
      )

      // replica.events.on('update', (): void => { void this.latest() })
    }
    const stopping = async (): Promise<void> => {
      this._storage != null && await this._storage.close()

      this._storage = null
      this._index = null
    }
    super({ starting, stopping })

    this.manifest = manifest
    this.directory = directory
    this.blocks = blocks
    this.config = manifest.store.config
    this.replica = replica

    this.Datastore = Datastore
    this._storage = null
    this._index = null

    this.events = new EventEmitter()
  }

  get index (): IpldDatastore {
    if (this._index == null) {
      throw new Error('keyvalue not started')
    }

    return this._index
  }

  // will return the latest reduced state to hand to selectors
  async latest (): Promise<IpldDatastore> {
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
