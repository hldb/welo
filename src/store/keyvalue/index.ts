import { EventEmitter, CustomEvent } from '@libp2p/interfaces/events'
import { Key } from 'interface-datastore'
import type { Datastore } from 'interface-datastore'

import { Playable } from '@/utils/playable.js'
import { loadHashMap } from '@/replica/graph.js'
import { decodedcid, encodedcid } from '@/utils/index.js'
import { Blocks } from '@/blocks/index.js'
import { CodeError } from '@libp2p/interfaces/errors'
import type { Replica } from '@/replica/index.js'
import type { Manifest } from '@/manifest/index.js'

import protocol, { Config } from './protocol.js'
import { creators, selectors, reducer } from './model.js'
import type { IpldDatastore } from '@/utils/paily.js'
import type { AnyLink } from '@alanshaw/pail/link'
import type { StoreComponent, StoreInstance, Events, Props } from '../interface.js'

interface PersistedRoot {
  index: AnyLink
  replica: AnyLink
}

export class Keyvalue extends Playable implements StoreInstance {
  get selectors (): typeof selectors {
    return selectors
  }

  get creators (): typeof creators {
    return creators
  }

  readonly manifest: Manifest
  readonly blocks: Blocks
  readonly config?: Config
  readonly replica: Replica
  readonly datastore: Datastore
  private _index: IpldDatastore | null
  events: EventEmitter<Events>

  constructor ({
    manifest,
    blocks,
    replica,
    datastore
  }: Props) {
    const starting = async (): Promise<void> => {
      let indexesCID: Uint8Array | undefined

      try {
        indexesCID = await this.storage.get(indexesKey)
      } catch (error) {}

      // replica.events.on('update', (): void => { void this.latest() })
    }
    const stopping = async (): Promise<void> => {
      this._index = null
    }
    super({ starting, stopping })

    this.manifest = manifest
    this.blocks = blocks
    this.config = manifest.store.config as Config
    this.replica = replica

    this.datastore = datastore
    this._index = null

    this.events = new EventEmitter()
  }

  get storage (): Datastore {
    return this.datastore
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

export const keyvalueStore: () => StoreComponent<Keyvalue, typeof protocol> = () => ({
  protocol,
  create: (props: Props) => new Keyvalue(props)
})
