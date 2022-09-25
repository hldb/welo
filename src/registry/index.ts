import { Register } from './register'
import { AccessStatic } from '../access/interface'
import { EntryStatic } from '../entry/interface'
import { IdentityStatic } from '../identity/interface'
import { StoreStatic } from '../store/interface'
import accessPrefix from '../access/prefix'
import entryPrefix from '../entry/prefix'
import identityPrefix from '../identity/prefix'
import storePrefix from '../store/prefix'

export interface Registry {
  access: Register<AccessStatic>
  entry: Register<EntryStatic<any>>
  identity: Register<IdentityStatic<any>>
  store: Register<StoreStatic>
}

export const initRegistry = (): Registry => ({
  access: new Register<AccessStatic>(accessPrefix),
  entry: new Register<EntryStatic<any>>(entryPrefix),
  identity: new Register<IdentityStatic<any>>(identityPrefix),
  store: new Register<StoreStatic>(storePrefix)
})
