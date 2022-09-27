import { PubSub } from '@libp2p/interface-pubsub'
import { PeerId } from '@libp2p/interfaces/peer-id'
import { IPFS } from 'ipfs'

import { AccessProtocol } from './access/default/protocol'
import { EntryProtocol } from './entry/default/protocol'
import { IdentityProtocol } from './identity/default/protocol'
import { IdentityInstance } from './identity/interface'
import { Blocks } from './mods/blocks'
import { Keychain } from './mods/keychain'
import { StorageReturn } from './mods/storage'
import { StoreProtocol } from './store/keyvalue/protocol'

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

// export interface OpalInstance extends Startable {
//   get registry(): Registry
//
//   directory: string
//
//   identity: IdentityInstance<any> | null
//   blocks: Blocks
//
//   storage: OpalStorage | null
//   identities: StorageReturn | null
//   keychain: Keychain | null
//
//   ipfs: IPFS | null
//   peerId: PeerId | null
//   pubsub: PubSub | null
//
//   readonly opened: Map<string, Database>
//
//   determine: (determine: Determine) => Promise<ManifestInstance<any>>
//   fetch: (fetch: Address) => Promise<ManifestInstance<any>>
//   open: (manifest: ManifestInstance<any>, options?: Options) => Promise<Database>
// }

// export interface OpalStatic {
//   get registry(): Registry
//   new(config: Config): OpalInstance
//   create: (create: Create) => Promise<OpalInstance>
//   Storage?: StorageFunc
//   Keychain?: typeof Keychain
//   // static Replicator?: typeof Replicator
//   get Manifest(): ManifestStatic<any>
// }
