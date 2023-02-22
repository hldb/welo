import { EventEmitter, CustomEvent } from '@libp2p/interfaces/events'
import { start, stop } from '@libp2p/interfaces/startable'
import type { CID } from 'multiformats/cid'

import { Playable } from '~utils/playable.js'
import { Replica } from '~replica/index.js'
import type { Blocks } from '~blocks/index.js'
import type { EntryStatic } from '~entry/interface.js'
import type { IdentityInstance, IdentityStatic } from '~identity/interface.js'
import type { Address } from '~manifest/address.js'
import type { Manifest } from '~manifest/index.js'
import type { AccessInstance } from '~access/interface.js'
import type { Creator, Selector, StoreInstance } from '~store/interface.js'
import type { DatastoreClass } from '~utils/datastore.js'
import type { Replicator } from '~replicator/interface.js'

import type { DbConfig, DbOpen, DbEvents, ClosedEmit } from './interface.js'

/**
 * Database Class
 *
 * @public
 */
export class Database extends Playable {
  readonly directory: string
  readonly blocks: Blocks
  readonly manifest: Manifest
  readonly identity: IdentityInstance<any>
  readonly replicator: Replicator

  readonly replica: Replica
  readonly access: AccessInstance
  readonly store: StoreInstance

  readonly Datastore: DatastoreClass
  readonly Entry: EntryStatic<any>
  readonly Identity: IdentityStatic<any>

  readonly events: EventEmitter<DbEvents>
  readonly #onStoreUpdate: typeof onStoreUpdate

  get address (): Address {
    return this.manifest.address
  }

  constructor (config: DbConfig) {
    const starting = async (): Promise<void> => {
      this.store.events.addEventListener('update', this.#onStoreUpdate)
      await start(this.access, this.replica, this.store, this.replicator)
    }
    const stopping = async (): Promise<void> => {
      this.replica.events.removeEventListener('update', this.#onStoreUpdate)
      await stop(this.store, this.replica, this.access, this.replicator)
    }
    super({ starting, stopping })

    this.Datastore = config.Datastore
    this.directory = config.directory
    this.manifest = config.manifest
    this.blocks = config.blocks
    this.identity = config.identity
    this.replicator = config.replicator
    this.replica = config.replica

    this.replicator = config.replicator

    this.store = config.store
    this.access = config.access
    this.Entry = config.Entry
    this.Identity = config.Identity

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
      directory,
      Datastore,
      manifest,
      Replicator,
      ipfs,
      libp2p,
      w3,
      identity,
      blocks,
      Store,
      Access,
      Entry,
      Identity
    } = options

    if (identity.constructor !== Identity) {
      throw new Error('identity instance type does not match Identity class')
    }

    const common = { manifest, blocks, Datastore }

    const directories = {
      // access: directory + '/access',
      replica: directory + '/replica',
      store: directory + '/store'
      // replicator: directory + '/replicator'
    }

    const access = new Access(common)
    const replica = new Replica({
      ...common,
      directory: directories.replica,
      identity,
      Entry,
      Identity,
      access
    })
    const store = new Store({
      ...common,
      directory: directories.store,
      replica
    })
    const replicator = new Replicator({
      ...common,
      ipfs,
      libp2p,
      w3,
      replica
    })

    const config: DbConfig = {
      directory,
      Datastore,
      blocks,
      replicator,
      identity,
      manifest,
      replica,
      store,
      access,
      Replicator,
      Access,
      Entry,
      Identity,
      Store
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
