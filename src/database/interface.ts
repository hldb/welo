import type { PeerId } from '@libp2p/interface-peer-id'
import type { IPFS } from 'ipfs'
import type { Libp2p } from 'libp2p'

import { AccessInstance, AccessStatic } from '~access/interface'
import { EntryStatic } from '~entry/interface'
import { IdentityInstance, IdentityStatic } from '~identity/interface'
import { ManifestInstance } from '~manifest/interface'
import { Blocks } from '~blocks/index.js'
import { MultiReplicator } from '~replicator/multi.js'
import { getStorage } from '~storage/index.js'
import { StoreInstance, StoreStatic } from '~store/interface'

import { Replica } from './replica'

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
