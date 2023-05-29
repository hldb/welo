import { EventEmitter, CustomEvent } from '@libp2p/interfaces/events'
import { start, stop } from '@libp2p/interfaces/startable'
import { NamespaceDatastore } from 'datastore-core'
import { Key } from 'interface-datastore'
import type { CID } from 'multiformats/cid'
import type { Datastore } from 'interface-datastore'

import { Playable } from '@/utils/playable.js'
import { Replica } from '@/replica/index.js'
import type { Blocks } from '@/blocks/index.js'
import type { IdentityInstance } from '@/identity/interface.js'
import type { Address } from '@/manifest/address.js'
import type { Manifest } from '@/manifest/index.js'
import type { AccessInstance } from '@/access/interface.js'
import type { Creator, Selector, StoreInstance } from '@/store/interface.js'
import type { Replicator } from '@/replicator/interface.js'
import { STORE_NAMESPACE, REPLICA_NAMESPACE } from '@/utils/constants.js'

import type { DbConfig, DbOpen, DbEvents, ClosedEmit, Components } from './interface.js'

/**
 * Database Class
 *
 * @public
 */
export class Database extends Playable {
  readonly blocks: Blocks
  readonly manifest: Manifest
  readonly identity: IdentityInstance<any>
  readonly replicators: Replicator[]

  readonly replica: Replica
  readonly access: AccessInstance
  readonly store: StoreInstance

  readonly datastore: Datastore
  readonly components: Components

  readonly events: EventEmitter<DbEvents>
  readonly #onStoreUpdate: typeof onStoreUpdate

  get address (): Address {
    return this.manifest.address
  }

  constructor (config: DbConfig) {
    const starting = async (): Promise<void> => {
      this.store.events.addEventListener('update', this.#onStoreUpdate)
      await start(this.access, this.replica, this.store, ...this.replicators)
    }
    const stopping = async (): Promise<void> => {
      this.replica.events.removeEventListener('update', this.#onStoreUpdate)
      await stop(this.store, this.replica, this.access, ...this.replicators)
    }
    super({ starting, stopping })

    this.datastore = config.datastore
    this.manifest = config.manifest
    this.blocks = config.blocks
    this.identity = config.identity
    this.replicators = config.replicators
    this.replica = config.replica

    this.store = config.store
    this.access = config.access
    this.components = config.components

    this.events = new EventEmitter()
    this.#onStoreUpdate = onStoreUpdate.bind(this)

    // expose actions as database write methods (e.g. database.put)
    // todo: handle async action creators

    interface CreatorProps {
      value: (...args: any[]) => Promise<CID>
    }

    const handleCreator = ([key, creator]: [string, Creator]): [
      string,
      CreatorProps
    ] => [
      key,
      {
        value: async (...args: any[]): Promise<CID> =>
          await this.replica.write(creator(...args)).then((entry) => entry.cid)
      }
    ]

    interface SelectorProps {
      value: (...args: any[]) => Promise<any>
    }

    const handleSelector = ([key, selector]: [string, Selector]): [
      string,
      SelectorProps
    ] => [
      key,
      {
        value: async (...args: any[]) =>
          selector(await this.store.latest())(...args)
      }
    ]

    Object.defineProperties(
      this,
      Object.fromEntries([
        ...Object.entries(this.store.creators).map(handleCreator),
        ...Object.entries(this.store.selectors).map(handleSelector)
      ])
    )
  }

  /**
   * Open a Database
   *
   * @remarks
   * Welo Database factory uses this method, and provides the modules needed,
   * to return databases from its `open` instance method.
   *
   * @param options - Contains properties and modules for the database to use
   * @returns
   */
  static async open (options: DbOpen): Promise<Database> {
    const {
      datastore,
      manifest,
      replicators,
      ipfs,
      identity,
      blocks,
      components
    } = options

    if (manifest.identity.protocol !== components.identity.protocol) {
      throw new Error('identity instance type does not match identity protocol')
    }

    const common = { manifest, blocks, datastore }

    const access = components.access.create(common)

    const replica = new Replica({
      ...common,
      datastore: new NamespaceDatastore(datastore, new Key(REPLICA_NAMESPACE)),
      identity,
      components,
      access
    })

    const store = components.store.create({
      ...common,
      datastore: new NamespaceDatastore(datastore, new Key(STORE_NAMESPACE)),
      replica
    })

    const replicatorInstances = replicators.map(replicator => replicator.create({
      ...common,
      ipfs,
      replica
    }))

    const config: DbConfig = {
      datastore,
      blocks,
      replicators: replicatorInstances,
      identity,
      manifest,
      replica,
      store,
      access,
      components
    }

    const database = new Database(config)

    if (options.start !== false) {
      await start(database)
    }

    return database
  }

  /**
   * Close the Database
   *
   * @remarks
   * Welo database factory listens for the closed method to be called
   * to manage lifecycles of databases it's managing.
   */
  async close (): Promise<void> {
    await stop(this)
    this.events.dispatchEvent(
      new CustomEvent<ClosedEmit>('closed', {
        detail: { address: this.address }
      })
    )
  }
}

function onStoreUpdate (this: Database): void {
  this.events.dispatchEvent(new CustomEvent<undefined>('update'))
}
