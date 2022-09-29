import EventEmitter from 'events'
import where from 'wherearewe'

// import * as version from './version.js'
import { initRegistry, Registry } from './registry'
import { Manifest, Address } from './manifest/default/index.js'
import { Database } from './database/index.js'
import { Blocks } from './mods/blocks.js'
import { OPAL_LOWER } from './utils/constants.js'
import { dirs, DirsReturn, defaultManifest, getComponents } from './utils'
import { StorageFunc, StorageReturn } from './mods/storage.js'
import { Keychain } from './mods/keychain/index.js'
import { Replicator } from './mods/replicator/index.js'
import { IPFS } from 'ipfs'
import { PeerId } from '@libp2p/interface-peer-id'
import { PubSub } from '@libp2p/interface-pubsub'
import { Config, Create, Determine, OpalStorage, Options } from './interface'
import { IdentityInstance } from './identity/interface'
import { ManifestData } from './manifest/interface'
import { start } from '@libp2p/interfaces/dist/src/startable'
import { Playable } from './utils/playable'

const registry = initRegistry()

export class Opal extends Playable {
  static get registry (): Registry {
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

  identity: IdentityInstance<any>
  blocks: Blocks
  events: EventEmitter

  storage: OpalStorage | null
  identities: StorageReturn | null
  keychain: Keychain | null

  ipfs: IPFS | null
  peerId: PeerId | null
  pubsub: PubSub | null

  readonly opened: Map<string, Database>
  private readonly _opening: Map<string, Promise<Database>>

  constructor ({
    directory,
    identity,
    blocks,
    storage,
    identities,
    keychain,
    ipfs,
    peerId,
    pubsub
  }: Config) {
    const starting = async (): Promise<void> => {
      // in the future it might make sense to open some stores automatically here
    }
    const stopping = async (): Promise<void> => {
      await Promise.all(Object.values(this._opening))
      await Promise.all(Object.values(this.opened).map(async (db: Database) => await db.stop()))

      this.events.emit('stop')
      this.events.removeAllListeners('opened')
      this.events.removeAllListeners('closed')
    }
    super({ starting, stopping })

    this.directory = directory
    this.dirs = dirs(this.directory)

    this.identity = identity
    this.blocks = blocks

    this.storage = storage
    this.identities = identities
    this.keychain = keychain

    this.ipfs = ipfs
    this.peerId = peerId
    this.pubsub = pubsub

    this.events = new EventEmitter()

    this.opened = new Map()
    this._opening = new Map()
  }

  static async create (options: Create): Promise<Opal> {
    let directory: string = OPAL_LOWER
    if (where.isNode && typeof options.directory === 'string') {
      directory = options.directory
    }

    let identity, storage, identities, keychain

    if (options.identity != null) {
      identity = options.identity
    } else {
      if (this.Storage === undefined || this.Keychain === undefined) {
        throw new Error(
          'Opal.create: missing Storage and Keychain; unable to create Identity'
        )
      }

      storage = {
        identities: await this.Storage(dirs(directory).identities),
        keychain: await this.Storage(dirs(directory).keychain)
      }

      identities = storage.identities
      keychain = await Keychain.create(storage.keychain)

      const Identity = this.registry.identity.star
      identity = await Identity.get({
        name: 'default',
        identities,
        keychain
      })
    }

    let blocks
    if (options.blocks != null) {
      blocks = options.blocks
    } else if (options.ipfs != null) {
      blocks = new Blocks(options.ipfs)
    } else {
      throw new Error('need blocks or ipfs as option')
    }

    const config: Config = {
      directory,
      identity,
      blocks,
      storage: storage ?? null,
      identities: identities ?? null,
      keychain: keychain ?? null,
      ipfs: options.ipfs ?? null,
      peerId: options.peerId ?? null,
      pubsub: options.pubsub ?? null
    }

    const opal = new Opal(config)

    if (options.start !== false) {
      await start(opal)
    }

    return opal
  }

  // static get version () { return version }

  static get Manifest (): typeof Manifest {
    return Manifest
  }

  async determine (options: Determine): Promise<Manifest> {
    const manifestObj: ManifestData = {
      ...defaultManifest(options.name, this.identity, this.registry),
      ...options
    }

    const manifest = await Manifest.create(manifestObj)
    await this.blocks.put(manifest.block)

    try {
      getComponents(this.registry, manifest)
    } catch (e) {
      console.warn('manifest configuration contains unregistered components')
    }

    return manifest
  }

  async fetch (address: Address): Promise<Manifest> {
    return await Manifest.fetch({ blocks: this.blocks, address })
  }

  async open (manifest: Manifest, options: Options = {}): Promise<Database> {
    const address = manifest.address
    const addr: string = address.toString()

    const isOpen =
      this.opened.get(addr) != null || this._opening.get(addr) != null

    if (isOpen) {
      throw new Error(`database ${addr} is already open or being opened`)
    }

    const components = getComponents(this.registry, manifest)

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
        this.opened.set(addr, db)
        this.events.emit('opened', db)
        db.events.once('closed', () => {
          this.opened.delete(addr)
          this.events.emit('closed', db)
        })
        return db
      })
      .catch((e) => {
        console.error(e)
        throw new Error(`failed opening database with address: ${addr}`)
      })
      .finally(() => {
        this._opening.delete(addr)
      })

    this._opening.set(addr, promise)

    return await promise
  }
}
