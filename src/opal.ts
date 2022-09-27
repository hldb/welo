import EventEmitter from 'events'
import where from 'wherearewe'

// import * as version from './version.js'
import { initRegistry, Registry } from './registry'
import { Manifest, Address } from './manifest/default/index.js'
import { Database } from './database/index.js'
import { Blocks } from './mods/blocks.js'
import { OPAL_LOWER } from './constants.js'
import { dirs, DirsReturn, defaultManifest, createIdentity } from './util.js'
import { StorageFunc, StorageReturn } from './mods/storage.js'
import { Keychain } from './mods/keychain/index.js'
import { Replicator } from './mods/replicator/index.js'
import { IPFS } from 'ipfs'
import { PeerId } from '@libp2p/interface-peer-id'
import { PubSub } from '@libp2p/interface-pubsub'
import { Extends } from './decorators'
import { Config, Create, Determine, OpalInstance, OpalStatic, OpalStorage, Options } from './interface'
import { IdentityInstance } from './identity/interface'
import { ManifestData } from './manifest/interface'
import { start } from '@libp2p/interfaces/dist/src/startable'

const registry = initRegistry()

@Extends<OpalStatic>()
class Opal implements OpalInstance {
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

  private _isStarted: boolean
  private _isMid: boolean

  isStarted (): boolean {
    return this._isStarted
  }

  async start (): Promise<void> {
    if (!this.isStarted()) { return }

    // in the future it might make sense to open some stores automatically here

    this.events.emit('start')
    this._isStarted = true
  }

  async stop (): Promise<void> {
    if (this.isStarted()) { return }
    this._isMid = true

    await Promise.all(Object.values(this._opening))
    await Promise.all(
      Object.values(this.opened).map(async (db: Database) => await db.close())
    )

    this.events.emit('stop')
    this.events.removeAllListeners('opened')
    this.events.removeAllListeners('closed')

    this._isStarted = false
    this._isMid = false
  }

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

    this._isStarted = false
    this._isMid = false
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

      identity = await createIdentity({
        Identity: registry.identity.star,
        Keychain: this.Keychain,
        storage
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
      Manifest.getComponents(this.registry, manifest)
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
