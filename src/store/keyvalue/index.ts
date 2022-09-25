import EventEmitter from 'events'

import { Replica } from '../../database/replica.js'
import { staticImplements } from '../../decorators.js'
import { ManifestData, ManifestInterface } from '../../manifest/interface.js'
import { actions, selectors, init, reducer } from './model'
import protocol, { Store, Config } from './protocol.js'

interface ManifestValue extends ManifestData {
  store: Store
}

@staticImplements(StoreStatic)
class Keyvalue implements StoreInterface {
  static get protocol (): string {
    return protocol
  }

  get actions (): typeof actions {
    return actions
  }

  get selectors (): typeof selectors {
    return selectors
  }

  get index (): Map<string, any> {
    return this._index
  }

  private _index: Map<string, any>

  readonly manifest: ManifestInterface<ManifestValue>
  readonly config?: Config
  readonly replica: Replica
  events: EventEmitter

  constructor ({ manifest, replica }: { manifest: ManifestInterface<ManifestValue>, replica: Replica }) {
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

export { Keyvalue }
