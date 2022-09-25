import EventEmitter from 'events'

import { Replica } from '../../database/replica.js'
import { Extends } from '../../decorators.js'
import { StoreStatic, StoreInstance, Open } from '../interface'
import { ManifestData, ManifestInstance } from '../../manifest/interface.js'
import { creators, selectors, init, reducer } from './model'
import protocol, { Store, Config } from './protocol.js'

interface ManifestValue extends ManifestData {
  store: Store
}

@Extends<StoreStatic>()
export class Keyvalue implements StoreInstance {
  static get protocol (): string {
    return protocol
  }

  get creators (): typeof creators {
    return creators
  }

  get selectors (): typeof selectors {
    return selectors
  }

  get index (): Map<string, any> {
    return this._index
  }

  private _index: Map<string, any>

  readonly manifest: ManifestInstance<ManifestValue>
  readonly config?: Config
  readonly replica: Replica
  events: EventEmitter

  constructor ({ manifest, replica }: { manifest: ManifestInstance<ManifestValue>, replica: Replica }) {
    this.manifest = manifest
    this.replica = replica

    if (manifest.store.config != null) {
      this.config = manifest.store.config
    }

    this._index = init()

    this.events = new EventEmitter()
  }

  static async open (open: Open): Promise<Keyvalue> {
    return new Keyvalue(open)
  }

  async close (): Promise<void> {
    this._index = init()
  }

  async update (): Promise<void> {
    const index = init()
    for await (const entry of await this.replica.traverse()) {
      reducer(index, entry)
    }
    this._index = index
    this.events.emit('update')
  }
}
