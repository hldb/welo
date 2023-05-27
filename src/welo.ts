import { EventEmitter, CustomEvent } from '@libp2p/interfaces/events'
import { start, stop } from '@libp2p/interfaces/startable'
import { NamespaceDatastore } from 'datastore-core'
import { Key } from 'interface-datastore'
import type { GossipHelia } from '@/interface'
import type { Datastore } from 'interface-datastore'

import { Manifest, Address } from '@/manifest/index.js'
import { Blocks } from '@/blocks/index.js'
import { Playable } from '@/utils/playable.js'
import type { ReplicatorModule } from '@/replicator/interface.js'
import type { IdentityInstance } from '@/identity/interface.js'
import type { ManifestData } from '@/manifest/interface.js'
import type { KeyChain } from '@/utils/types.js'
import { DATABASE_NAMESPACE, IDENTITY_NAMESPACE } from '@/utils/constants.js'

// import * as version from './version.js'
import { Database } from './database.js'
import type {
  ClosedEmit,
  Config,
  Create,
  Determine,
  Events,
  // FetchOptions,
  OpenedEmit,
  OpenOptions,
  Components
} from './interface.js'

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
  private readonly replicators: ReplicatorModule[]
  private readonly datastore: Datastore
  private readonly handlers: Config['handlers']

  readonly ipfs: GossipHelia
  readonly blocks: Blocks

  readonly keychain: KeyChain

  readonly identity: IdentityInstance<any>

  readonly events: EventEmitter<Events>

  readonly opened: Map<string, Database>
  private readonly _opening: Map<string, Promise<Database>>

  constructor ({
    identity,
    blocks,
    keychain,
    ipfs,
    handlers,
    datastore,
    replicators
  }: Config) {
    const starting = async (): Promise<void> => {
      // in the future it might make sense to open some stores automatically here
    }
    const stopping = async (): Promise<void> => {
      await Promise.all(Object.values(this._opening))
      await Promise.all(Object.values(this.opened).map(stop))
    }
    super({ starting, stopping })

    this.identity = identity
    this.blocks = blocks

    this.keychain = keychain

    this.ipfs = ipfs

    this.events = new EventEmitter()

    this.opened = new Map()
    this._opening = new Map()

    this.handlers = handlers
    this.datastore = datastore
    this.replicators = replicators
  }

  /**
   * Create an Welo instance
   *
   * @param options - options
   * @returns a promise which resolves to an Welo instance
   */
  static async create (options: Create): Promise<Welo> {
    const ipfs = options.ipfs
    if (ipfs == null) {
      throw new Error('ipfs is a required option')
    }

    let identity: IdentityInstance<any>
    let identities: Datastore | null = null

    if (options.identity != null) {
      identity = options.identity
    } else {
      identities = new NamespaceDatastore(options.datastore, new Key(IDENTITY_NAMESPACE))

      identity = await options.handlers.identity[0].get({
        name: 'default',
        identities,
        keychain: ipfs.libp2p.keychain
      })
    }

    const config: Config = {
      identity,
      ipfs,
      blocks: new Blocks(ipfs),
      keychain: ipfs.libp2p.keychain,
      handlers: options.handlers,
      datastore: options.datastore,
      replicators: options.replicators ?? []
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
      ...this.getDefaultManifest(options.name),
      ...options
    }

    const manifest = await Manifest.create(manifestObj)
    await this.blocks.put(manifest.block)

    try {
      this.getComponents(manifest)
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

    const datastore = options.datastore ?? this.datastore
    const replicators = options.replicators ?? this.replicators

    const components = this.getComponents(manifest)

    if (
      components.access == null ||
      components.entry == null ||
      components.identity == null ||
      components.store == null
    ) {
      throw new Error('missing components')
    }

    const promise = Database.open({
      ...components,
      manifest,
      identity,
      ipfs: this.ipfs,
      blocks: this.blocks,
      datastore: new NamespaceDatastore(datastore, new Key(`${DATABASE_NAMESPACE}/${manifest.address.cid.toString()}`)),
      replicators,
      identityModule: components.identity
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

  getComponents (manifest: Manifest): Components {
    const access = this.handlers.access.find(h => h.protocol === manifest.access.protocol)
    const entry = this.handlers.entry.find(h => h.protocol === manifest.entry.protocol)
    const identity = this.handlers.identity.find(h => h.protocol === manifest.identity.protocol)
    const store = this.handlers.store.find(h => h.protocol === manifest.store.protocol)

    if (access == null || entry == null || identity == null || store == null) {
      throw new Error('missing component(s)')
    }

    return {
      access,
      entry,
      identity: identity,
      store: store
    }
  }

  private getDefaultManifest (name: string): ManifestData {
    return {
      name,
      store: {
        protocol: this.handlers.store[0].protocol
      },
      access: {
        protocol: this.handlers.access[0].protocol,
        config: { write: [this.identity.id] }
      },
      entry: {
        protocol: this.handlers.entry[0].protocol
      },
      identity: {
        protocol: this.handlers.identity[0].protocol
      }
    }
  }
}
