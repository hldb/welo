import { PubSub } from '@libp2p/interface-pubsub'
import { PeerId } from '@libp2p/interfaces/peer-id'
import { IPFS } from 'ipfs'

import { AccessProtocol } from './access/static/protocol.js'
import { EntryProtocol } from './entry/default/protocol.js'
import { IdentityProtocol } from './identity/default/protocol.js'
import { IdentityInstance } from './identity/interface.js'
import { Blocks } from './mods/blocks.js'
import { Keychain } from './mods/keychain/index.js'
import { StorageReturn } from './mods/storage.js'
import { StoreProtocol } from './store/keyvalue/protocol.js'

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
  Storage?: StorageReturn
  // Replicator?: typeof Replicator
}

export interface Config {
  directory: string
  identity: IdentityInstance<any>
  blocks: Blocks
  storage: OpalStorage | null
  identities: StorageReturn | null
  keychain: Keychain | null
  ipfs: IPFS | null
  peerId: PeerId | null
  pubsub: PubSub | null
}

export interface Create {
  directory?: string
  identity?: IdentityInstance<any>
  ipfs?: IPFS
  blocks?: Blocks
  peerId?: PeerId
  pubsub?: PubSub
  start?: boolean
}
