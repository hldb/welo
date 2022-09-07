import EventEmitter from 'events'
import { Identity } from 'src/manifest/identity/index.js'
import { Replica } from './replica.js'

import type { Manifest } from 'src/manifest/index.js'
import type { Blocks } from 'src/mods/blocks.js'
import { Keyvalue } from 'src/manifest/store/keyvalue.js'
import { StaticAccess } from 'src/manifest/access/static.js'
import { Entry } from 'src/manifest/entry/index.js'
// const typeMismatch = (Component) =>
//  `${Component}.type does not match manifest.${Component.toLowerCase()}.type`

interface DatabaseShared {
  blocks: Blocks
  identity: Identity
  manifest: Manifest
  Entry: typeof Entry
  Identity: typeof Identity
}

interface DatabaseOptions extends DatabaseShared {
  Store: typeof Keyvalue
  Access: typeof StaticAccess
}

interface DatabaseConfig extends DatabaseShared {
  replica: Replica
  store: Keyvalue
  access: StaticAccess
}

export class Database {
  blocks: Blocks
  identity: Identity
  manifest: Manifest
  replica: Replica
  store: Keyvalue
  access: StaticAccess
  Entry: typeof Entry
  Identity: typeof Identity
  events: EventEmitter
  open: Boolean
  _handlers: any

  constructor(config: DatabaseConfig) {
    // this.storage = config.storage
    this.blocks = config.blocks
    this.identity = config.identity
    this.manifest = config.manifest
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
            value: (key: string, value?: any) =>
              this.replica.write(action(key, value))
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

    this.open = true
  }

  static async open(options: DatabaseOptions) {
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

    if ((identity.constructor as typeof Identity).type !== Identity.type) {
      throw new Error('identity instance type does not match Identity class')
    }

    const common = { manifest, blocks } // createStorage }

    const access = await Access.open({ ...common })
    const replica = await Replica.open({
      ...common,
      identity,
      Entry,
      Identity,
      access
    })
    const store = await Store.open()

    // no replication yet
    // config.replicator = new Replicator({ peerId, pubsub, ...common, access, replica })
    // options.replicate && await config.replicator.start()

    const config: DatabaseConfig = {
      blocks,
      identity,
      manifest,
      replica,
      store,
      access,
      Entry,
      Identity
    }

    const database = new Database(config)

    database._handlers = {
      storeUpdate: () => database.events.emit('update'),
      // replicatorReplicate: () => database.events.emit('replicate'),
      replicaWrite: () => database.events.emit('write')
    }
    database.store.events.on('update', database._handlers.storeUpdate)
    // database.replicator.events.on('replicate', database._handlers.replicatorReplicate)
    database.replica.events.on('write', database._handlers.replicaWrite)

    return database
  }

  async close() {
    if (!this.open) {
      return
    }
    this.open = false

    // await this.replicator.stop()

    this.store.events.removeListener('update', this._handlers.storeUpdate)
    // this.replicator.events.removeListener('replicate', this._handlers.replicatorReplicate)
    this.replica.events.removeListener('write', this._handlers.replicaWrite)

    await this.store.close()
    await this.replica.close()
    await this.access.close()

    // await Promise.all([
    //   this.replicator.close(),
    //   this.store.close(),
    //   this.replica.close(),
    //   this.access.close()
    // ])

    this.events.emit('close')
  }
}
