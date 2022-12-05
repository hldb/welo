import type { Startable } from '@libp2p/interfaces/startable'

import type { Replica } from '~database/replica.js'
import type { ManifestInstance } from '~manifest/interface.js'
import type { Blocks } from '~blocks/index.js'
import type { DatastoreClass } from '~utils/datastore.js'
import type { Registrant } from '~registry/registrant.js'

export interface Props {
  manifest: ManifestInstance<any>
  directory: string
  blocks: Blocks
  replica: Replica
  Datastore: DatastoreClass
}

export type Creator = (...args: any[]) => any

export type Selector = (state: any) => (...args: any[]) => any

export interface StoreInstance extends Startable {
  creators: {
    [key: string]: Creator
  }
  selectors: {
    [key: string]: Selector
  }
  latest: () => Promise<any>
}

export interface StoreStatic extends Registrant {
  new (props: Props): StoreInstance
}
