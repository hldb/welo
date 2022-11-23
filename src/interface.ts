import type { IPFS } from 'ipfs-core-types'
import type { Libp2p } from 'libp2p'
import { Datastore } from 'interface-datastore'

import { AccessProtocol } from '~access/static/protocol.js'
import { EntryProtocol } from '~entry/basal/protocol.js'
import { IdentityProtocol } from '~identity/basal/protocol.js'
import { IdentityInstance } from '~identity/interface.js'
import { Blocks } from '~blocks/index.js'
import { getStorage } from '~storage/index.js'
import { StoreProtocol } from '~store/keyvalue/protocol.js'
import { Replicator } from '~replicator/index.js'
import { KeyChain } from '~utils/types.js'

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
  Storage?: getStorage
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
