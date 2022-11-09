import { IPFS } from 'ipfs'
import { PeerId } from '@libp2p/interface-peer-id'
import { PubSub } from '@libp2p/interface-pubsub'
import { AccessInstance, AccessStatic } from '../access/interface'
import { EntryStatic } from '../entry/interface'
import { IdentityInstance, IdentityStatic } from '../identity/interface'
import { ManifestInstance } from '../manifest/interface'
import { Blocks } from '../blocks'
import { MultiReplicator } from '../replicator/multi.js'
import { StorageFunc } from '../storage'
import { StoreInstance, StoreStatic } from '../store/interface'
import { Replica } from './replica'

export interface Open {
  directory: string
  Storage: StorageFunc
  start?: boolean
  blocks: Blocks
  Replicator: typeof MultiReplicator
  ipfs?: IPFS
  pubsub?: PubSub
  peerId?: PeerId
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
