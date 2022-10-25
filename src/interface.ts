import { PubSub } from '@libp2p/interface-pubsub'
import { PeerId } from '@libp2p/interface-peer-id'
import { IPFS } from 'ipfs'

import { AccessProtocol } from './access/static/protocol.js'
import { EntryProtocol } from './entry/default/protocol.js'
import { IdentityProtocol } from './identity/default/protocol.js'
import { IdentityInstance } from './identity/interface.js'
import { Blocks } from './mods/blocks.js'
import { Keychain } from './mods/keychain.js'
import { StorageFunc, StorageReturn } from './mods/storage.js'
import { StoreProtocol } from './store/keyvalue/protocol.js'
import { Replicator } from './mods/replicator/index.js'

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
