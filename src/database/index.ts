import EventEmitter from 'events'

import { Replica } from './replica.js'
import { Blocks } from '../mods/blocks.js'
import { start, stop, Startable } from '@libp2p/interfaces/dist/src/startable.js'
import { EntryStatic } from '../entry/interface.js'
import { IdentityInstance, IdentityStatic } from '../identity/interface.js'
import { ManifestInstance } from '../manifest/interface.js'
import { Config, Hanlders, Open } from './interface.js'
import { AccessInstance } from '../access/interface.js'
import { StoreInstance } from '../store/interface.js'

export class Database implements Startable {
  manifest: ManifestInstance<any>
  blocks: Blocks

  identity: IdentityInstance<any>
  replica: Replica

  access: AccessInstance
  store: StoreInstance

  Entry: EntryStatic<any>
  Identity: IdentityStatic<any>

  events: EventEmitter
  private readonly _handlers: Hanlders

  private _isStarted: boolean

  isStarted (): boolean {
    return this._isStarted
  }

  async start (): Promise<void> {
    if (!this.isStarted()) { return }

    await start(this.access)
    await start(this.store)

    this._isStarted = true
  }

  async stop (): Promise<void> {
    if (!this.isStarted()) { return }

    // await this.replicator.stop()

    // this.store.events.removeListener('update', this._handlers.storeUpdate)
    // this.replicator.events.removeListener('replicate', this._handlers.replicatorReplicate)
    // this.replica.events.removeListener('write', this._handlers.replicaWrite)

    await stop(this.store)
    await this.replica.close()
    await stop(this.access)

    // await Promise.all([
    //   this.replicator.close(),
    //   this.store.close(),
    //   this.replica.close(),
    //   this.access.close()
    // ])

    this._isStarted = false
    this.events.emit('closed')
  }

  constructor (config: Config) {
    // this.storage = config.storage
    this.manifest = config.manifest
    this.blocks = config.blocks
    this.identity = config.identity
    this.replica = config.replica

    // this.replicator = config.replicator

    this.store = config.store
    this.access = config.access
    this.Entry = config.Entry
    this.Identity = config.Identity

    // expose actions as database write methods (e.g. database.put)
    // todo: handle async action creators
    Object.defineProperties(
      this,
      Object.fromEntries(
        Object.entries(this.store.actions).map(([key, action]) => [
          key,
          {
            value: async (key: string, value?: any) =>
              await this.replica.write(action(key, value))
          }
        ])
      )
    )

    // expose selectors as database read methods (e.g. database.get)
    // todo: async reads/lazy state calculation
    Object.defineProperties(
      this,
      Object.fromEntries(
        Object.entries(this.store.selectors).map(([key, selector]) => [
          key,
          { value: selector(this.store.state) }
        ])
      )
    )

    this.events = new EventEmitter()
    this._handlers = {
      storeUpdate: () => this.events.emit('update'),
      // replicatorReplicate: () => database.events.emit('replicate'),
      replicaWrite: () => this.events.emit('write')
    }

    this._isStarted = false
  }

  static async open (options: Open): Promise<Database> {
    const {
      // createStorage,
      manifest,
      identity,
      // peerId,
      // pubsub,
      blocks,
      Store,
      Access,
      // Replicator,
      Entry,
      Identity
    } = options

    if (identity.constructor !== Identity) {
      throw new Error('identity instance type does not match Identity class')
    }

    const common = { manifest, blocks } // createStorage }

    const access = new Access(common)
    await start(access)
    const replica = await Replica.open({
      ...common,
      identity,
      Entry,
      Identity,
      access
    })
    const store = new Store({ replica })
    await start(store)

    // no replication yet
    // config.replicator = new Replicator({ peerId, pubsub, ...common, access, replica })
    // options.replicate && await config.replicator.start()

    const config: Config = {
      blocks,
      identity,
      manifest,
      replica,
      store,
      access,
      Access,
      Entry,
      Identity,
      Store
    }

    const database = new Database(config)

    // database.store.events.on('update', database._handlers.storeUpdate)
    // database.replicator.events.on('replicate', database._handlers.replicatorReplicate)
    // database.replica.events.on('write', database._handlers.replicaWrite)

    if (options.start !== false) {
      await start(database)
    }

    return database
  }
}
