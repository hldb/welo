import type { AccessStatic } from '~/access/interface.js'
import type { EntryStatic } from '~/entry/interface.js'
import type { IdentityStatic } from '~/identity/interface.js'
import type { StoreStatic } from '~/store/interface.js'
import accessPrefix from '~/access/prefix.js'
import entryPrefix from '~/entry/prefix.js'
import identityPrefix from '~/identity/prefix.js'
import storePrefix from '~/store/prefix.js'

import { Register } from './utils/register.js'

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
