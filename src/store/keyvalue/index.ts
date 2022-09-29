import EventEmitter from 'events'

import { Replica } from '../../database/replica.js'
import { Extends } from '../../decorators.js'
import { StoreStatic, StoreInstance } from '../interface'
import { ManifestData, ManifestInstance } from '../../manifest/interface.js'
import { creators, selectors, init, reducer } from './model'
import protocol, { StoreProtocol, Config } from './protocol.js'
import { Playable } from '../../pausable.js'

interface ManifestValue extends ManifestData {
  store: StoreProtocol
}

@Extends<StoreStatic>()
export class Keyvalue extends Playable implements StoreInstance {
  static get protocol (): string {
    return protocol
  }

  private _index: Map<string, any>

  get index (): Map<string, any> {
    return this._index
  }

  get selectors (): typeof selectors {
    return selectors
  }

  get creators (): typeof creators {
    return creators
  }

  readonly manifest: ManifestInstance<ManifestValue>
  readonly config?: Config
  readonly replica: Replica
  events: EventEmitter

  constructor ({ manifest, replica }: { manifest: ManifestInstance<ManifestValue>, replica: Replica }) {
    const starting = async (): Promise<void> => {
    }
    const stopping = async (): Promise<void> => {
      this._index = init()
    }
    super({ starting, stopping })

    this.manifest = manifest
    this.config = manifest.store.config
    this.replica = replica

    this._index = init()

    this.events = new EventEmitter()
  }

  // will return the latest reduced state to hand to selectors
  async latest (): Promise<any> {
    const index = init()
    for await (const entry of await this.replica.traverse()) {
      reducer(index, entry)
    }
    this.events.emit('update')
    return index
  }
}
