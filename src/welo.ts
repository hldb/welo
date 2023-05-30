import { EventEmitter, CustomEvent } from '@libp2p/interfaces/events'
import { start, stop } from '@libp2p/interfaces/startable'
import { NamespaceDatastore } from 'datastore-core'
import { Key } from 'interface-datastore'
import type { Components, GossipHelia } from '@/interface'
import type { Datastore } from 'interface-datastore'
import type { KeyChain } from '@libp2p/interface-keychain'

import { Manifest, Address } from '@/manifest/index.js'
import { Blocks } from '@/blocks/index.js'
import { Playable } from '@/utils/playable.js'
import { cidstring } from '@/utils/index.js'
import type { ReplicatorModule } from '@/replicator/interface.js'
import type { IdentityInstance } from '@/identity/interface.js'
import type { ManifestData } from '@/manifest/interface.js'
import { DATABASE_NAMESPACE, IDENTITY_NAMESPACE } from '@/utils/constants.js'

// import * as version from './version.js'
import { Database } from './database.js'
import type {
  ClosedEmit,
  Config,
  WeloInit,
  Determine,
  Events,
  // FetchOptions,
  OpenedEmit,
  OpenOptions
} from './interface.js'
import { liveReplicator } from './replicator/live/index.js'
import { basalIdentity } from './identity/basal/index.js'
import { staticAccess } from './access/static/index.js'
import { keyvalueStore } from './store/keyvalue/index.js'
import { basalEntry } from './entry/basal/index.js'
import type { DbComponents } from './interface'

export { Manifest, Address }
export type {
  Playable,
  Database,
  Config,
  WeloInit as Create,
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
  private readonly components: Config['components']

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
    components,
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

    this.components = components
    this.datastore = datastore
    this.replicators = replicators
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

    const dbKey = new Key(`${DATABASE_NAMESPACE.toString()}/${cidstring(manifest.address.cid)}`)

    const promise = Database.open({
      manifest,
      identity,
      ipfs: this.ipfs,
      blocks: this.blocks,
      datastore: new NamespaceDatastore(datastore, dbKey),
      replicators,
      components
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

  getComponents (manifest: Manifest): DbComponents {
    const access = this.components.access.find(h => h.protocol === manifest.access.protocol)
    const entry = this.components.entry.find(h => h.protocol === manifest.entry.protocol)
    const identity = this.components.identity.find(h => h.protocol === manifest.identity.protocol)
    const store = this.components.store.find(h => h.protocol === manifest.store.protocol)

    if (access == null || entry == null || identity == null || store == null) {
      throw new Error('missing component(s)')
    }

    return { access, entry, identity, store }
  }

  private getDefaultManifest (name: string): ManifestData {
    return {
      name,
      store: {
        protocol: this.components.store[0].protocol
      },
      access: {
        protocol: this.components.access[0].protocol,
        config: { write: [this.identity.id] }
      },
      entry: {
        protocol: this.components.entry[0].protocol
      },
      identity: {
        protocol: this.components.identity[0].protocol
      }
    }
  }
}

const getDefaultReplicators = (): ReplicatorModule[] => [liveReplicator()]
const getDefaultComponents = (): Components => ({
  identity: [basalIdentity()],
  access: [staticAccess()],
  store: [keyvalueStore()],
  entry: [basalEntry()]
})

/**
 * Create an Welo instance
 *
 * @param opts - options
 * @returns a promise which resolves to an Welo instance
 */
export const createWelo = async (init: WeloInit): Promise<Welo> => {
  if (init.ipfs == null) {
    throw new Error('ipfs is a required option')
  }

  const ipfs = init.ipfs
  const datastore = init.datastore ?? ipfs.datastore
  const replicators = init.replicators ?? getDefaultReplicators()
  const components = init.components ?? getDefaultComponents()

  let identity: IdentityInstance<any>

  if (init.identity != null) {
    identity = init.identity
  } else {
    const identities = new NamespaceDatastore(datastore, new Key(IDENTITY_NAMESPACE))

    identity = await components.identity[0].get({
      name: 'default',
      identities,
      keychain: ipfs.libp2p.keychain
    })
  }

  const config: Config = {
    ipfs,
    keychain: ipfs.libp2p.keychain,
    datastore,
    identity,
    blocks: new Blocks(ipfs),
    replicators,
    components
  }

  const welo = new Welo(config)

  if (init.start !== false) {
    await start(welo)
  }

  return welo
}
