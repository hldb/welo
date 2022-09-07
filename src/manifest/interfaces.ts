import { StaticAccess } from './access/static.js'
import { Entry } from './entry/index.js'
import { Identity } from './identity/index.js'
import { Keyvalue } from './store/keyvalue.js'

export interface Components {
  Store: typeof Keyvalue
  Access: typeof StaticAccess
  Entry: typeof Entry
  Identity: typeof Identity
}

export interface ComponentConfig<Type> {
  type: Type
}
