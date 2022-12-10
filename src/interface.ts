import type { IPFS } from 'ipfs-core-types'
import type { Libp2p } from 'libp2p'
import type { Datastore } from 'interface-datastore'

import type { AccessProtocol } from '~access/static/protocol.js'
import type { EntryProtocol } from '~entry/basal/protocol.js'
import type { IdentityProtocol } from '~identity/basal/protocol.js'
import type { IdentityInstance, IdentityStatic } from '~identity/interface.js'
import type { Blocks } from '~blocks/index.js'
import type { StoreProtocol } from '~store/keyvalue/protocol.js'
import type { KeyChain } from '~utils/types.js'
import type { DatastoreClass } from '~utils/datastore.js'
import type { Address, Manifest } from '~manifest/index.js'
import type { AccessInstance, AccessStatic } from '~access/interface.js'
import type { EntryStatic } from '~entry/interface.js'
import type { StoreInstance, StoreStatic } from '~store/interface'
import type { Replica } from '~replica/index.js'
import type { Replicator, ReplicatorClass } from '~replicator/interface'

/** @public */
export interface Create {
  directory?: string
  identity?: IdentityInstance<any>
  ipfs: IPFS
  libp2p: Libp2p
  start?: boolean
}

export interface Config {
  directory: string
  identity: IdentityInstance<any>
  blocks: Blocks
  identities: Datastore | null
  keychain: KeyChain
  ipfs: IPFS
  libp2p: Libp2p
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

/** @public */
export { FetchOptions } from '~utils/types'

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
  ipfs?: IPFS
  libp2p?: Libp2p
  identity: IdentityInstance<any>
  manifest: Manifest
  Access: AccessStatic
  Entry: EntryStatic<any>
  Identity: IdentityStatic<any>
  Store: StoreStatic
}

export interface DbConfig extends Omit<DbOpen, 'start'> {
  replicator: Replicator
  replica: Replica
  store: StoreInstance
  access: AccessInstance
}

export interface DbEvents {
  closed: CustomEvent<ClosedEmit>
  update: CustomEvent<undefined>
}
