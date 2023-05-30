import { EventEmitter, CustomEvent } from '@libp2p/interfaces/events'
import { Key } from 'interface-datastore'
import { encode, decode } from '@ipld/dag-cbor'
import type { Datastore } from 'interface-datastore'
import type { Blockstore } from 'interface-blockstore'
import type { CID } from 'multiformats/cid'

import { Playable } from '@/utils/playable.js'
import type { Replica } from '@/replica/index.js'
import type { Manifest } from '@/manifest/index.js'

import protocol, { Config } from './protocol.js'
import { creators, selectors, reducer, StateMap, init, load } from './model.js'
import type { ShardLink } from '@alanshaw/pail/shard'
import type { StoreComponent, StoreInstance, Events, Props } from '../interface.js'

interface PersistedRoot {
  index: ShardLink
  replica: CID
}

const indexKey = new Key('index')

export class Keyvalue extends Playable implements StoreInstance {
  get selectors (): typeof selectors {
    return selectors
  }

  get creators (): typeof creators {
    return creators
  }

  readonly manifest: Manifest
  readonly config?: Config
  readonly replica: Replica
  readonly datastore: Datastore
  readonly blockstore: Blockstore
  private _index: StateMap | null
  events: EventEmitter<Events>

  constructor ({
    manifest,
    blocks,
    replica,
    datastore,
    blockstore
  }: Props) {
    const starting = async (): Promise<void> => {
      let bytes: Uint8Array | undefined
      try {
        bytes = await this.datastore.get(indexKey)
      } catch {
        bytes = undefined
      }

      if (bytes != null) {
        const persistedRoot: PersistedRoot = decode(bytes)
        this._index = await load(this.blockstore, persistedRoot.index)
      } else {
        await this.latest()
      }

      // replica.events.on('update', (): void => { void this.latest() })
    }
    const stopping = async (): Promise<void> => {
      this._index = null
    }
    super({ starting, stopping })

    this.manifest = manifest
    this.config = manifest.store.config as Config
    this.replica = replica

    this.datastore = datastore
    this.blockstore = blockstore
    this._index = null

    this.events = new EventEmitter()
  }

  get index (): StateMap {
    if (this._index == null) {
      throw new Error('keyvalue not started')
    }

    return this._index
  }

  // will return the latest reduced state to hand to selectors
  async latest (): Promise<StateMap> {
    const index = await init(this.blockstore)

    const replicaRoot = this.replica.root
    if (replicaRoot == null) {
      throw new Error('replica hash not defined')
    }

    for await (const entry of await this.replica.traverse()) {
      await reducer(index, entry)
    }

    const persistedRoot: PersistedRoot = { index: index.root, replica: replicaRoot }
    await this.datastore.put(indexKey, encode(persistedRoot))

    this._index = index
    this.events.dispatchEvent(new CustomEvent<undefined>('update'))
    return index
  }
}

export const keyvalueStore: () => StoreComponent<Keyvalue, typeof protocol> = () => ({
  protocol,
  create: (props: Props) => new Keyvalue(props)
})
