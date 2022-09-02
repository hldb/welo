
import EventEmitter from 'events'
import where from 'wherearewe'
import path from 'path'

// import * as version from './version.js'
import { Manifest, Address } from './manifest/index.js'
import { Register } from './register.js'
import { Database } from './database/index.js'
import { OPAL_LOWER } from './constants.js'

const registry = Object.fromEntries([
  'store',
  'access',
  'entry',
  'identity'
].map(k => [k, new Register(`/${OPAL_LOWER}/${k}`)]))

const dirs = root => Object.fromEntries([
  'databases',
  'identities',
  'keychain'
].map(k => [k, path.join(root, k)]))

// database factory
class Opal {
  constructor (config) {
    this.directory = config.directory
    this.dirs = dirs(this.directory)

    this.identity = config.identity

    this.identities = config.identities
    this.keychain = config.keychain

    this.blocks = config.blocks
    this.peerId = config.peerId
    this.pubsub = config.pubsub

    this.events = new EventEmitter()

    this.opened = {}
    this._opening = {}
  }

  static async create (options = {}) {
    let directory
    if (where.isNode) {
      directory = path.resolve(options.directory || OPAL_LOWER)
    } else {
      directory = OPAL_LOWER
    }

    const config = {
      directory,
      offline: options.offline === true,
      blocks: options.blocks || options.ipfs.block
      // peerId and pubsub is not required but for some replicators
      // peerId: options.peerId || null,
      // pubsub: options.pubsub || options.ipfs.pubsub || null
    }

    if (options.identity) {
      config.identity = options.identity
    } else {
      const storage = {
        identities: await this.Storage(dirs(directory).identities),
        keychain: await this.Storage(dirs(directory).keychain)
      }
      await storage.identities.open()
      await storage.keychain.open()

      config.identities = storage.identities
      config.keychain = new this.Keychain({ getDatastore: () => storage.keychain })

      const Identity = this.registry.identity.star
      config.identity = await Identity.get({
        name: 'default',
        identities: config.identities,
        keychain: config.keychain
      })
    }

    return new Opal(config)
  }

  // static get version () { return version }

  static get Manifest () { return Manifest }

  static get registry () { return registry }
  get registry () { return registry }

  // modules assigned in src/index.js
  /*
  * Opal.Storage
  * Opal.Keychain
  * Opal.Replicator
  */

  async stop () {
    await Promise.all(Object.values(this._opening))
    await Promise.all(Object.values(this.opened).map(db => db.close()))

    this.events.emit('stop')
    this.events.removeAllListeners('opened')
    this.events.removeAllListeners('closed')

    await this.identities.close()
    await this.keychain.components.getDatastore().close()
  }

  async determineManifest (name, options = {}) {
    if (typeof name !== 'string') throw new Error('name must be a string')

    // clean this up
    const opts = {
      version: 1,
      store: {
        type: this.registry.store.star.type
      },
      access: {
        type: this.registry.access.star.type,
        write: [this.identity.id]
      },
      entry: {
        type: this.registry.entry.star.type
      },
      identity: {
        type: this.registry.identity.star.type
      },
      // only add option properties that match the registry keys
      // probably replace this with something in Manifest.create later
      ...(Object.keys(this.registry).reduce((obj, key) => { options[key] && (obj[key] = options[key]); return obj }, {})),
      // only add meta if it exists
      ...(options.meta ? options.meta : {})
    }

    const manifest = await Manifest.create({ name, ...opts })
    await this.blocks.put(manifest.block.bytes, { version: 1, format: 'dag-cbor' })

    try {
      Manifest.getComponents(this.registry, manifest)
    } catch (e) {
      if (options.warn !== false) {
        console.warn('manifest configuration contains unregistered components')
      }
    }

    return manifest
  }

  async fetchManifest (address) {
    address = Address.asAddress(address, true)
    return Manifest.fetch({ blocks: this.blocks, address })
  }

  async open (manifest, options = {}) {
    manifest = await Manifest.asManifest(manifest, true)
    const address = manifest.address

    const isOpen = this.opened[address] || this._opening[address]
    if (isOpen) {
      throw new Error(`database ${address} is already open or being opened`)
    }

    const components = Manifest.getComponents(this.registry, manifest)

    // this will return a duplicate instance of the identity (not epic) until the instances cache is used by Identity.get
    const identity = options.identity || await components.Identity.get({
      name: 'default',
      identities: this.identities,
      keychain: this.keychain
    })

    // const Storage = options.Storage || Opal.Storage
    const Replicator = options.Replicator || Opal.Replicator

    // const location = path.join(this.dirs.databases, manifest.address.cid.toString(base32))

    // not worrying about persistent databases for now
    // const createStorage = name => new Storage(path.join(location, name), this.storageOps)
    const createStorage = () => {}

    this._opening[address] = Database.open({
      odb: this, // passed for access controllers if they need to make another database
      manifest,
      blocks: this.blocks,
      peerId: this.peerId,
      pubsub: this.pubsub,
      identity,
      Replicator,
      createStorage,
      options,
      ...Manifest.getComponents(this.registry, manifest)
    }).then(db => {
      this.opened[address] = db
      delete this._opening[address]
      this.events.emit('opened', db)
      db.events.once('closed', () => {
        delete this.opened[address]
        this.events.emit('closed', db)
      })
      return db
    }).catch(e => {
      console.error(e)
      throw new Error(`failed opening database with address: ${address}`)
    })

    return this._opening[address]
  }
}

export { Opal }
