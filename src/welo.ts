import path from 'path'
import { EventEmitter, CustomEvent } from '@libp2p/interfaces/events'
import * as where from 'wherearewe'
import { start, stop } from '@libp2p/interfaces/startable'
import type { Helia } from '@helia/interface'
import type { Libp2p } from 'libp2p'

import { Manifest, Address } from '~manifest/index.js'
import { Blocks } from '~blocks/index.js'
import { WELO_PATH } from '~utils/constants.js'
import { Playable } from '~utils/playable.js'
import { getDatastore, DatastoreClass } from '~utils/datastore.js'
import {
  dirs,
  DirsReturn,
  defaultManifest,
  getComponents,
  cidstring
} from '~utils/index.js'
import type { ReplicatorClass } from '~replicator/interface.js'
import type { IdentityInstance } from '~identity/interface.js'
import type { ManifestData } from '~manifest/interface.js'
import type { KeyChain } from '~utils/types.js'

// import * as version from './version.js'
import { initRegistry, Registry } from './registry.js'
import { Database } from './database.js'
import type {
  ClosedEmit,
  Config,
  Create,
  Determine,
  Events,
  // FetchOptions,
  OpenedEmit,
  OpenOptions
} from './interface.js'
import type { LevelDatastore } from 'datastore-level'

const registry = initRegistry()

export { Manifest, Address }
export type {
  Playable,
  Database,
  Config,
  Create,
  Determine,
  // FetchOptions,
  OpenOptions as Options
}

/**
 * Database Factory
 *
 * @public
 */
export class Welo extends Playable {
  /**
   *
   */
  static get registry (): Registry {
    return registry
  }

  static Datastore?: DatastoreClass
  static Replicator?: ReplicatorClass

  private readonly dirs: DirsReturn
  readonly directory: string

  readonly ipfs: Helia
  readonly libp2p: Libp2p
  readonly blocks: Blocks

  readonly identities: LevelDatastore | null
  readonly keychain: KeyChain

  readonly identity: IdentityInstance<any>

  readonly events: EventEmitter<Events>

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

  /**
   * Create an Welo instance
   *
   * @param options - options
   * @returns a promise which resolves to an Welo instance
   */
  static async create (options: Create): Promise<Welo> {
    let directory: string = WELO_PATH
    if (where.isNode && typeof options.directory === 'string') {
      directory = options.directory ?? '.' + directory
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
    let identities: LevelDatastore | null = null

    if (options.identity != null) {
      identity = options.identity
    } else {
      if (this.Datastore == null) {
        throw new Error('Welo.create: missing Datastore')
      }

      identities = await getDatastore(
        this.Datastore,
        dirs(directory).identities
      )

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

    const welo = new Welo(config)

    if (options.start !== false) {
      await start(welo)
    }

    return welo
  }

  // static get version () { return version }

  /**
   * Deterministically create a database manifest
   *
   * @remarks
   * Options are shallow merged with {@link defaultManifest}.
   *
   * @param options - Override defaults used to create the manifest.
   * @returns
   */
  async determine (options: Determine): Promise<Manifest> {
    const manifestObj: ManifestData = {
      ...defaultManifest(options.name, this.identity, registry),
      ...options
    }

    const manifest = await Manifest.create(manifestObj)
    await this.blocks.put(manifest.block)

    try {
      getComponents(registry, manifest)
    } catch (e) {
      console.warn('manifest configuration contains unregistered components')
    }

    return manifest
  }

  /**
   * Fetch a Database Manifest
   *
   * @remarks
   * Convenience method for using `Manifest.fetch`.
   *
   * @param address - the Address of the Manifest to fetch
   * @returns
   */
  async fetch (address: Address): Promise<Manifest> {
    return await Manifest.fetch({ blocks: this.blocks, address })
  }

  /**
   * Opens a database for a manifest.
   *
   * @remarks
   * This method will throw an error if the database is already opened or being opened.
   * Use {@link Welo.opened} to get opened databases.
   *
   * @param manifest - the manifest of the database to open
   * @param options - optional configuration for how to run the database
   * @returns the database instance for the given manifest
   */
  async open (manifest: Manifest, options: OpenOptions = {}): Promise<Database> {
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

    let Datastore: DatastoreClass
    if (options.Datastore != null) {
      Datastore = options.Datastore
    } else if (Welo.Datastore != null) {
      Datastore = Welo.Datastore
    } else {
      throw new Error('no Datastore attached to Welo class')
    }

    let Replicator: ReplicatorClass
    if (options.Replicator != null) {
      Replicator = options.Replicator
    } else if (Welo.Replicator != null) {
      Replicator = Welo.Replicator
    } else {
      throw new Error('no Replicator attached to Welo class')
    }

    const directory = path.join(
      this.dirs.databases,
      cidstring(manifest.address.cid)
    )

    const promise = Database.open({
      directory,
      manifest,
      identity,
      ipfs: this.ipfs,
      libp2p: this.libp2p,
      blocks: this.blocks,
      Datastore,
      Replicator,
      ...getComponents(registry, manifest)
    })
      .then((database) => {
        this.opened.set(addr, database)
        this.events.dispatchEvent(
          new CustomEvent<OpenedEmit>('opened', {
            detail: { address }
          })
        )
        database.events.addEventListener(
          'closed',
          () => {
            this.opened.delete(addr)
            this.events.dispatchEvent(
              new CustomEvent<ClosedEmit>('closed', {
                detail: { address }
              })
            )
          },
          { once: true }
        )
        return database
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
