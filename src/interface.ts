import type { IPFS } from 'ipfs-core-types'
import type { Libp2p } from 'libp2p'
import type { Datastore } from 'interface-datastore'

import type { AccessProtocol } from '~access/static/protocol.js'
import type { EntryProtocol } from '~entry/basal/protocol.js'
import type { IdentityProtocol } from '~identity/basal/protocol.js'
import type { IdentityInstance } from '~identity/interface.js'
import type { Blocks } from '~blocks/index.js'
import type { StoreProtocol } from '~store/keyvalue/protocol.js'
import type { Replicator } from '~replicator/index.js'
import type { KeyChain } from '~utils/types.js'
import type { DatastoreClass } from '~utils/datastore'

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

export interface Options {
  identity?: IdentityInstance<any>
  Datastore?: DatastoreClass
  Replicator?: typeof Replicator
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

export interface Create {
  directory?: string
  identity?: IdentityInstance<any>
  ipfs: IPFS
  libp2p: Libp2p
  start?: boolean
}
