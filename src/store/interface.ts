import { Replica } from '../database/replica'
import { Implements } from '../decorators'
import { ManifestInstance } from '../manifest/interface'
import { Registrant } from '../registry/registrant'

export interface Open {
  manifest: ManifestInstance<any>
  replica: Replica
}

export interface StoreInstance {
  creators: {
    [key: string]: Function
  }
  selectors: {
    [key: string]: Function
  }
  close: () => Promise<void>
  update: () => Promise<void>
}

export interface StoreStatic extends Implements<StoreInstance>, Registrant {
  open: (open: Open) => Promise<StoreInstance>
}
