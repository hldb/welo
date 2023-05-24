import type { Helia } from '@helia/interface'
import type { Libp2p, ServiceMap } from '@libp2p/interface-libp2p'
import type { PubSub } from '@libp2p/interface-pubsub'
import type { LevelDatastore } from 'datastore-level'

import type { AccessProtocol } from '@/access/static/protocol.js'
import type { EntryProtocol } from '@/entry/basal/protocol.js'
import type { IdentityProtocol } from '@/identity/basal/protocol.js'
import type { IdentityInstance, IdentityStatic } from '@/identity/interface.js'
import type { Blocks } from '@/blocks/index.js'
import type { StoreProtocol } from '@/store/keyvalue/protocol.js'
import type { KeyChain } from '@/utils/types.js'
import type { DatastoreClass } from '@/utils/datastore.js'
import type { Address, Manifest } from '@/manifest/index.js'
import type { AccessInstance, AccessStatic } from '@/access/interface.js'
import type { EntryStatic } from '@/entry/interface.js'
import type { StoreInstance, StoreStatic } from '@/store/interface'
import type { Replica } from '@/replica/index.js'
import type { Replicator, ReplicatorClass } from '@/replicator/interface'

export type GossipServiceMap = ServiceMap & { pubsub: PubSub }
export type GossipLibp2p<T extends GossipServiceMap = GossipServiceMap> = Libp2p<T>
export type GossipHelia<T extends GossipLibp2p<GossipServiceMap> = GossipLibp2p<GossipServiceMap>> = Helia<T>

/** @public */
export interface Create {
  directory?: string
  identity?: IdentityInstance<any>
  ipfs: GossipHelia
  libp2p: GossipLibp2p
  start?: boolean

  handlers: {
    access: AccessStatic[]
    store: StoreStatic[]
    entry: EntryStatic<any>[]
    identity: IdentityStatic<any>[]
  }
}

export interface Config {
  directory: string
  identity: IdentityInstance<any>
  blocks: Blocks
  identities: LevelDatastore | null
  keychain: KeyChain
  ipfs: GossipHelia
  libp2p: GossipLibp2p

  handlers: {
    access: AccessStatic[]
    store: StoreStatic[]
    entry: EntryStatic<any>[]
    identity: IdentityStatic<any>[]
  }
}

/** @public */
export interface Determine {
  protocol?: string
  name: string
  access?: AccessProtocol
  entry?: EntryProtocol
  identity?: IdentityProtocol
  store?: StoreProtocol
  meta?: any
  tag?: Uint8Array
}

// /** @public */ commented out a comment lol
// export { FetchOptions } from '@/utils/types'

/** @public */
export interface OpenOptions {
  identity?: IdentityInstance<any>
  Datastore?: DatastoreClass
  Replicator?: ReplicatorClass
}

interface AddressEmit {
  address: Address
}

export interface OpenedEmit extends AddressEmit {}
export interface ClosedEmit extends AddressEmit {}

export interface Events {
  opened: CustomEvent<OpenedEmit>
  closed: CustomEvent<ClosedEmit>
}

export interface DbOpen {
  directory: string
  Datastore: DatastoreClass
  start?: boolean
  blocks: Blocks
  Replicator: ReplicatorClass
  ipfs: GossipHelia
  libp2p: GossipLibp2p
  identity: IdentityInstance<any>
  manifest: Manifest
  Access: AccessStatic
  Entry: EntryStatic<any>
  Identity: IdentityStatic<any>
  Store: StoreStatic
}

export interface DbConfig extends Omit<DbOpen, 'start' | 'ipfs' | 'libp2p'> {
  replicator: Replicator
  replica: Replica
  store: StoreInstance
  access: AccessInstance
}

export interface DbEvents {
  closed: CustomEvent<ClosedEmit>
  update: CustomEvent<undefined>
}
