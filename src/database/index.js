
import EventEmitter from 'events'
import { Replica } from './replica.js'

const typeMismatch = (Component) => `${Component}.type does not match manifest.${Component.toLowerCase()}.type`

export class Database {
  constructor (config) {
    // this.storage = config.storage
    this.blocks = config.blocks
    this.options = config.options
    this.identity = config.identity

    this.replica = config.replica
    // this.replicator = config.replicator

    this.manifest = config.manifest
    this.store = config.store
    this.access = config.access
    this.Entry = config.Entry
    this.Identity = config.Identity

    // expose actions as database write methods (e.g. database.put)
    // todo: handle async action creators
    Object.defineProperties(this, Object.fromEntries(
      Object.entries(this.store.actions)
        .map(([key, action]) =>
          [key, { value: (...pass) => this.replica.write(action(...pass)) }])
    ))

    // expose selectors as database read methods (e.g. database.get)
    // todo: async reads/lazy state calculation
    Object.defineProperties(this, Object.fromEntries(
      Object.entries(this.store.selectors)
        .map(([key, selector]) =>
          [key, { value: selector(this.store.state) }])
    ))

    this.events = new EventEmitter()

    this.open = true
  }

  static async open (config) {
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
      Identity,
      options
    } = config

    if (identity.constructor.type !== Identity.type) {
      throw new Error('identity instance type does not match Identity class')
    }

    const common = { manifest, blocks } // createStorage }

    const access = config.access = await Access.open({ Identity, ...common })
    const replica = config.replica = await Replica.open({ ...common, identity, Entry, Identity, access })
    config.store = await Store.open({ ...common, access, replica })

    // no replication yet
    // config.replicator = new Replicator({ peerId, pubsub, ...common, access, replica })
    // options.replicate && await config.replicator.start()

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

  async close () {
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
