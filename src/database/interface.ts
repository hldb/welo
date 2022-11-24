import type { PeerId } from '@libp2p/interface-peer-id'
import type { IPFS } from 'ipfs-core-types'
import type { Libp2p } from 'libp2p'

import type { AccessInstance, AccessStatic } from '~access/interface'
import type { EntryStatic } from '~entry/interface'
import type { IdentityInstance, IdentityStatic } from '~identity/interface'
import type { ManifestInstance } from '~manifest/interface'
import type { Blocks } from '~blocks/index.js'
import type { MultiReplicator } from '~replicator/multi.js'
import type { getStorage } from '~storage/index.js'
import type { StoreInstance, StoreStatic } from '~store/interface'

import type { Replica } from './replica'

export interface Open {
  directory: string
  Storage: getStorage
  start?: boolean
  blocks: Blocks
  Replicator: typeof MultiReplicator
  peerId?: PeerId
  ipfs?: IPFS
  libp2p?: Libp2p
  identity: IdentityInstance<any>
  manifest: ManifestInstance<any>
  Access: AccessStatic
  Entry: EntryStatic<any>
  Identity: IdentityStatic<any>
  Store: StoreStatic
}

export interface Config extends Omit<Open, 'start'> {
  replicator: MultiReplicator
  replica: Replica
  store: StoreInstance
  access: AccessInstance
}

export interface Handlers {
  storeUpdate: () => boolean
  replicaWrite: () => boolean
}
