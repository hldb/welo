import type { PeerId } from '@libp2p/interface-peer-id'
import type { IPFS } from 'ipfs-core-types'
import type { Libp2p } from 'libp2p'

import { AccessProtocol } from '~access/static/protocol.js'
import { EntryProtocol } from '~entry/basal/protocol.js'
import { IdentityProtocol } from '~identity/basal/protocol.js'
import { IdentityInstance } from '~identity/interface.js'
import { Blocks } from '~blocks/index.js'
import { Keychain } from '~keychain/index.js'
import { StorageFunc, StorageReturn } from '~storage/index.js'
import { StoreProtocol } from '~store/keyvalue/protocol.js'
import { Replicator } from '~replicator/index.js'

export interface OpalStorage {
  identities: StorageReturn
  keychain: StorageReturn
}

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
  Storage?: StorageFunc
  Replicator?: typeof Replicator
}

export interface Config {
  directory: string
  identity: IdentityInstance<any>
  blocks: Blocks
  storage: OpalStorage | null
  identities: StorageReturn | null
  keychain: Keychain | null
  peerId: PeerId | null
  ipfs: IPFS | null
  libp2p: Libp2p | null
}

export interface Create {
  directory?: string
  identity?: IdentityInstance<any>
  peerId?: PeerId
  ipfs?: IPFS
  libp2p?: Libp2p
  blocks?: Blocks
  start?: boolean
}
