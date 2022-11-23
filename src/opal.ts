import path from 'path'
import EventEmitter from 'events'
import where from 'wherearewe'
import { base32 } from 'multiformats/bases/base32'
import { start, stop } from '@libp2p/interfaces/startable'
import type { IPFS } from 'ipfs-core-types'
import type { Libp2p } from 'libp2p'
import { Datastore } from 'datastore-level'

// import * as version from './version.js'
import { Config, Create, Determine, Options } from './interface.js'
import { initRegistry, Registry } from './registry/index.js'
import { Manifest, Address } from '~manifest/index.js'
import { Database } from '~database/index.js'
import { Blocks } from '~blocks/index.js'
import { OPAL_LOWER } from '~utils/constants.js'
import { getStorage } from '~storage/index.js'
import type { Replicator as ReplicatorClass } from '~replicator/index.js'
import { IdentityInstance } from '~identity/interface.js'
import { ManifestData } from '~manifest/interface.js'
import { Playable } from '~utils/playable.js'
import {
  dirs,
  DirsReturn,
  defaultManifest,
  getComponents
} from '~utils/index.js'
import { KeyChain } from '~utils/types.js'

const registry = initRegistry()

export class Opal extends Playable {
  static get registry (): Registry {
    return registry
  }

  get registry (): typeof Opal.registry {
    return Opal.registry
  }

  static Storage?: getStorage
  static Replicator?: typeof ReplicatorClass

  private readonly dirs: DirsReturn
  readonly directory: string

  readonly ipfs: IPFS
  readonly libp2p: Libp2p
  readonly blocks: Blocks

  readonly identities: Datastore | null
  readonly keychain: KeyChain

  readonly identity: IdentityInstance<any>

  readonly events: EventEmitter

  readonly opened: Map<string, Database>
  private readonly _opening: Map<string, Promise<Database>>

  constructor ({
    directory,
    identity,
    blocks,
    identities,
    keychain,
    ipfs,
    libp2p
  }: Config) {
    const starting = async (): Promise<void> => {
      // in the future it might make sense to open some stores automatically here
    }
    const stopping = async (): Promise<void> => {
      await Promise.all(Object.values(this._opening))
      await Promise.all(Object.values(this.opened).map(stop))

      this.events.emit('stop')
      this.events.removeAllListeners('opened')
      this.events.removeAllListeners('closed')
    }
    super({ starting, stopping })

    this.directory = directory
    this.dirs = dirs(this.directory)

    this.identity = identity
    this.blocks = blocks

    this.identities = identities
    this.keychain = keychain

    this.ipfs = ipfs
    this.libp2p = libp2p

    this.events = new EventEmitter()

    this.opened = new Map()
    this._opening = new Map()
  }

  static async create (options: Create): Promise<Opal> {
    let directory: string = OPAL_LOWER
    if (where.isNode && typeof options.directory === 'string') {
      directory = options.directory
    }

    const ipfs = options.ipfs
    if (ipfs == null) {
      throw new Error('ipfs is a required option')
    }

    const libp2p = options.libp2p
    if (libp2p == null) {
      throw new Error('libp2p is a required option')
    }

    let identity: IdentityInstance<any>
    let identities: Datastore | null = null

    if (options.identity != null) {
      identity = options.identity
    } else {
      if (this.Storage == null) {
        throw new Error('Opal.create: missing Storage')
      }

      identities = await this.Storage(dirs(directory).identities)

      await identities.open()
      const Identity = this.registry.identity.star
      identity = await Identity.get({
        name: 'default',
        identities,
        keychain: libp2p.keychain
      })
      await identities.close()
    }

    const config: Config = {
      directory,
      identity,
      identities,
      ipfs,
      blocks: new Blocks(ipfs),
      libp2p,
      keychain: libp2p.keychain
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

    if (this.opened.get(addr) != null) {
      throw new Error(`database ${addr} is already open`)
    }

    if (this._opening.get(addr) != null) {
      throw new Error(`database ${addr} is already being opened`)
    }

    let identity: IdentityInstance<any>
    if (options.identity != null) {
      identity = options.identity
    } else if (this.identity != null) {
      identity = this.identity
    } else {
      throw new Error('no identity available')
    }

    let Storage: getStorage
    if (options.Storage != null) {
      Storage = options.Storage
    } else if (Opal.Storage != null) {
      Storage = Opal.Storage
    } else {
      throw new Error('no Storage available')
    }

    let Replicator: typeof ReplicatorClass
    if (options.Replicator != null) {
      Replicator = options.Replicator
    } else if (Opal.Replicator != null) {
      Replicator = Opal.Replicator
    } else {
      throw new Error('no Replicator supplied')
    }

    const dbPath = path.join(
      this.dirs.databases,
      manifest.address.cid.toString(base32)
    )
    const dbStorage = async (_path: string): Promise<Datastore> =>
      await Storage(path.join(dbPath, _path))

    const promise = Database.open({
      directory: dbPath,
      Storage: dbStorage,
      Replicator,
      manifest,
      blocks: this.blocks,
      ipfs: this.ipfs,
      libp2p: this.libp2p,
      identity,
      ...getComponents(this.registry, manifest)
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
