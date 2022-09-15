import EventEmitter from 'events'
import where from 'wherearewe'

// import * as version from './version.js'
import { initRegistry, RegistryObj } from './formats/registry.js'
import { Manifest, Address, ManifestObj } from './formats/manifest/index.js'
import { Database } from './database/index.js'
import { Blocks } from './mods/blocks.js'
import { OPAL_LOWER } from './constants.js'
import { dirs, DirsReturn, defaultManifest } from './util.js'

import type { StorageFunc, StorageReturn } from './mods/storage.js'
import type { Keychain } from './mods/keychain/index.js'
import type { Replicator } from './database/replicator/index.js'
import type { Identity } from './formats/identity/index.js'
import type { IPFS } from 'ipfs'
import type { PeerId } from '@libp2p/interface-peer-id'
import type { PubSub } from '@libp2p/interface-pubsub'
type IdentityType = typeof Identity

interface OpalStorage {
  identities: StorageReturn
  keychain: StorageReturn
}

interface OpalShared {
  directory?: string
  identity?: Identity | undefined
  storage?: OpalStorage
  identities?: StorageReturn | undefined
  keychain?: Keychain | undefined
}

interface OpalConfig extends OpalShared {
  directory: string
  identity: Identity
  blocks: Blocks
  peerId?: PeerId
  pubsub?: PubSub
}

interface OpalOptions extends OpalShared {
  ipfs: IPFS
}

interface OpenOptions {
  identity?: Identity
  Storage?: StorageReturn
  Replicator?: typeof Replicator
}

const registry = initRegistry()

// database factory
class Opal {
  static get registry (): RegistryObj {
    return registry
  }

  get registry (): typeof Opal.registry {
    return Opal.registry
  }

  static Storage?: StorageFunc
  static Keychain?: typeof Keychain
  static Replicator?: typeof Replicator

  private readonly dirs: DirsReturn

  directory: string
  identity: Identity
  blocks: Blocks
  events: EventEmitter

  storage?: OpalStorage
  identities?: StorageReturn
  keychain?: Keychain

  ipfs?: IPFS
  peerId?: PeerId
  pubsub?: PubSub

  readonly opened: Map<string, Database>
  private readonly _opening: Map<string, Promise<Database>>

  constructor ({
    directory,
    identity,
    storage,
    identities,
    keychain,
    blocks,
    peerId,
    pubsub
  }: OpalConfig) {
    this.directory = directory
    this.dirs = dirs(this.directory)

    this.identity = identity
    this.storage = storage
    this.identities = identities
    this.keychain = keychain

    this.blocks = blocks
    this.peerId = peerId
    this.pubsub = pubsub

    this.events = new EventEmitter()

    this.opened = new Map()
    this._opening = new Map()
  }

  static async create (options: OpalOptions): Promise<Opal> {
    let directory: string = OPAL_LOWER
    if (where.isNode && typeof options.directory === 'string') {
      directory = options.directory
    }

    let identity, identities, keychain, storage

    if (options.identity != null) {
      identity = options.identity
    } else {
      if (this.Storage === undefined || this.Keychain === undefined) {
        throw new Error(
          'Opal.create: missing Storage and Keychain; unable to create Identity'
        )
      }

      const _storage: OpalStorage = {
        identities: await this.Storage(dirs(directory).identities),
        keychain: await this.Storage(dirs(directory).keychain)
      }
      storage = _storage
      await _storage.identities.open()
      await _storage.keychain.open()

      identities = storage.identities
      keychain = new this.Keychain(storage.keychain)

      const Identity: IdentityType = this.registry.identity.star
      identity = await Identity.get({
        name: 'default',
        identities,
        keychain
      })
    }

    const config: OpalConfig = {
      directory,
      identity,
      storage,
      identities,
      keychain,
      blocks: new Blocks(options.ipfs)
      // peerId and pubsub is not required but for some replicators
      // peerId: options.peerId || null,
      // pubsub: options.pubsub || options.ipfs.pubsub || null
    }

    return new Opal(config)
  }

  // static get version () { return version }

  static get Manifest (): typeof Manifest {
    return Manifest
  }

  async stop (): Promise<void> {
    await Promise.all(Object.values(this._opening))
    await Promise.all(
      Object.values(this.opened).map(async (db: Database) => await db.close())
    )

    this.events.emit('stop')
    this.events.removeAllListeners('opened')
    this.events.removeAllListeners('closed')

    if (this.storage != null) {
      await this.storage.identities.close()
      await this.storage.keychain.close()
    }
  }

  async determineManifest (
    name: string,
    options: Partial<ManifestObj> = {}
  ): Promise<Manifest> {
    const manifestObj: ManifestObj = {
      ...defaultManifest(name, this.identity, this.registry),
      ...options
    }

    const manifest = await Manifest.create(manifestObj)
    await this.blocks.put(manifest.block)

    try {
      Manifest.getComponents(this.registry, manifest)
    } catch (e) {
      console.warn('manifest configuration contains unregistered components')
    }

    return manifest
  }

  async fetchManifest (address: Address): Promise<Manifest> {
    return await Manifest.fetch({ blocks: this.blocks, address })
  }

  async open (manifest: Manifest, options: OpenOptions = {}): Promise<Database> {
    const address = manifest.address
    const string: string = address.toString()

    const isOpen =
      this.opened.get(string) != null || this._opening.get(string) != null

    if (isOpen) {
      throw new Error(`database ${string} is already open or being opened`)
    }

    const components = Manifest.getComponents(this.registry, manifest)

    // this will return a duplicate instance of the identity (not epic) until the instances cache is used by Identity.get

    const identity = options.identity != null ? options.identity : this.identity

    // const Storage = options.Storage || Opal.Storage
    // const Replicator = options.Replicator || Opal.Replicator;

    // const location = path.join(this.dirs.databases, manifest.address.cid.toString(base32))

    // not worrying about persistent databases for now
    // const createStorage = name => new Storage(path.join(location, name), this.storageOps)
    // const createStorage = () => {};

    const promise = Database.open({
      manifest,
      blocks: this.blocks,
      // peerId: this.peerId,
      // pubsub: this.pubsub,
      identity,
      // Replicator,
      // createStorage,
      ...components
    })
      .then((db) => {
        this.opened.set(string, db)
        this._opening.delete(string)
        this.events.emit('opened', db)
        db.events.once('closed', () => {
          this.opened.delete(string)
          this.events.emit('closed', db)
        })
        return db
      })
      .catch((e) => {
        console.error(e)
        throw new Error(`failed opening database with address: ${string}`)
      })

    this._opening.set(string, promise)

    return await promise
  }
}

export { Opal }
