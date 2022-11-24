import EventEmitter from 'events'
import { start, stop } from '@libp2p/interfaces/startable'
import type { CID } from 'multiformats/cid'

import { Playable } from '~utils/playable.js'
import type { Blocks } from '~blocks/index.js'
import type { EntryStatic } from '~entry/interface.js'
import type { IdentityInstance, IdentityStatic } from '~identity/interface.js'
import type { ManifestInstance } from '~manifest/interface.js'
import type { AccessInstance } from '~access/interface.js'
import type { Creator, Selector, StoreInstance } from '~store/interface.js'
import type { getStorage } from '~storage/index.js'
import type { MultiReplicator } from '~replicator/multi.js'

import { Replica } from './replica.js'
import type { Config, Handlers, Open } from './interface.js'

export class Database extends Playable {
  readonly directory: string
  readonly Storage: getStorage
  readonly blocks: Blocks
  readonly manifest: ManifestInstance<any>
  readonly identity: IdentityInstance<any>
  readonly replicator: MultiReplicator

  readonly replica: Replica
  readonly access: AccessInstance
  readonly store: StoreInstance

  readonly Entry: EntryStatic<any>
  readonly Identity: IdentityStatic<any>

  readonly events: EventEmitter

  private readonly _handlers: Handlers

  constructor (config: Config) {
    const starting = async (): Promise<void> => {
      await start(this.access, this.replica, this.store, this.replicator)
    }
    const stopping = async (): Promise<void> => {
      await stop(this.store, this.replica, this.access, this.replicator)
      // await this.replicator.stop()

      // this.store.events.removeListener('update', this._handlers.storeUpdate)
      // this.replicator.events.removeListener('replicate', this._handlers.replicatorReplicate)
      // this.replica.events.removeListener('write', this._handlers.replicaWrite)

      // await Promise.all([
      //   this.replicator.close(),
      //   this.store.close(),
      //   this.replica.close(),
      //   this.access.close()
      // ])
    }
    super({ starting, stopping })

    this.Storage = config.Storage
    this.directory = config.directory
    this.manifest = config.manifest
    this.blocks = config.blocks
    this.identity = config.identity
    this.replicator = config.replicator
    this.replica = config.replica

    // this.storage = config.storage
    // this.replicator = config.replicator

    this.store = config.store
    this.access = config.access
    this.Entry = config.Entry
    this.Identity = config.Identity

    this.events = new EventEmitter()
    this._handlers = {
      storeUpdate: () => this.events.emit('update'),
      // replicatorReplicate: () => database.events.emit('replicate'),
      replicaWrite: () => this.events.emit('write')
    }

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

  static async open (options: Open): Promise<Database> {
    const {
      directory,
      Storage,
      manifest,
      Replicator,
      peerId,
      ipfs,
      libp2p,
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

    const common = { manifest, blocks, Storage } // createStorage }

    const access = new Access(common)
    const replica = new Replica({
      ...common,
      identity,
      Entry,
      Identity,
      access
    })
    const store = new Store({ ...common, replica })
    const replicator = new Replicator({
      ...common,
      peerId,
      ipfs,
      libp2p,
      replica
    })

    const config: Config = {
      directory,
      Storage,
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

    // database.store.events.on('update', database._handlers.storeUpdate)
    // database.replicator.events.on('replicate', database._handlers.replicatorReplicate)
    // database.replica.events.on('write', database._handlers.replicaWrite)

    if (options.start !== false) {
      await start(database)
    }

    return database
  }

  async close (): Promise<void> {
    await stop(this)
    this.events.emit('closed')
  }
}
