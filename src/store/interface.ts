import { Startable } from '@libp2p/interfaces/dist/src/startable'
import { Replica } from '../database/replica'
import { ManifestInstance } from '../manifest/interface'
import { Registrant } from '../registry/registrant'

export interface Open {
  manifest: ManifestInstance<any>
  replica: Replica
}

export interface StoreInstance extends Startable {
  creators: {
    [key: string]: Function
  }
  selectors: {
    [key: string]: Function
  }
  update: () => Promise<void>
}

export interface StoreStatic extends Registrant {
  new(props: any): StoreInstance
}
