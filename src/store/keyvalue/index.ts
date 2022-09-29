import EventEmitter from 'events'

import { Replica } from '../../database/replica.js'
import { Extends } from '../../decorators.js'
import { StoreStatic, StoreInstance } from '../interface'
import { ManifestData, ManifestInstance } from '../../manifest/interface.js'
import { creators, selectors, init, reducer } from './model'
import protocol, { StoreProtocol, Config } from './protocol.js'
import { Startable } from '@libp2p/interfaces/dist/src/startable.js'

interface ManifestValue extends ManifestData {
  store: StoreProtocol
}

@Extends<StoreStatic>()
export class Keyvalue implements StoreInstance, Startable {
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

  private _isStarted: boolean
  private _starting: Promise<void> | null
  private _stopping: Promise<void> | null

  isStarted (): boolean {
    return this._isStarted
  }

  async start (): Promise<void> {
    if (this.isStarted()) { return }

    if (this._starting != null) {
      return await this._starting
    }

    if (this._stopping != null) {
      await this._stopping
    }

    this._starting = (async () => {
    })()

    await this._starting
      .then(() => { this._isStarted = true })
      .finally(() => { this._starting = null })
  }

  async stop (): Promise<void> {
    if (!this.isStarted()) { return }

    if (this._stopping != null) {
      return await this._stopping
    }

    if (this._starting != null) {
      await this._starting
    }

    this._stopping = (async () => {
      this._index = init()
    })()

    await this._stopping
      .then(() => { this._isStarted = false })
      .finally(() => { this._stopping = null })
  }

  constructor ({ manifest, replica }: { manifest: ManifestInstance<ManifestValue>, replica: Replica }) {
    this.manifest = manifest
    this.config = manifest.store.config
    this.replica = replica
    this._isStarted = false
    this._starting = null
    this._stopping = null

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
