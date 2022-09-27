import { AccessInstance, AccessStatic } from '../access/interface'
import { EntryStatic } from '../entry/interface'
import { IdentityInstance, IdentityStatic } from '../identity/interface'
import { ManifestInstance } from '../manifest/interface'
import { Blocks } from '../mods/blocks'
import { StoreInstance, StoreStatic } from '../store/interface'
import { Replica } from './replica'

export interface Open {
  start?: boolean
  blocks: Blocks
  identity: IdentityInstance<any>
  manifest: ManifestInstance<any>
  Access: AccessStatic
  Entry: EntryStatic<any>
  Identity: IdentityStatic<any>
  Store: StoreStatic
}

export interface Config extends Omit<Open, 'start'> {
  replica: Replica
  store: StoreInstance
  access: AccessInstance
}

export interface Hanlders {
  storeUpdate: () => boolean
  replicaWrite: () => boolean
}
