import { StaticAccess } from './access/default/index.js'
import { Entry } from './entry/default/index.js'
import { Identity } from './identity/default/index.js'
import { Keyvalue } from './store/keyvalue/index.js'

export interface Components {
  Store: typeof Keyvalue
  Access: typeof StaticAccess
  Entry: typeof Entry
  Identity: typeof Identity
}

export interface ComponentConfig<Type> {
  type: Type
}
