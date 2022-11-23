import { Startable } from '@libp2p/interfaces/startable'

import { Replica } from '~database/replica.js'
import { ManifestInstance } from '~manifest/interface.js'
import { Blocks } from '~blocks/index.js'
import { getStorage } from '~storage/index.js'
import { Registrant } from '~registry/registrant.js'

export interface Props {
  manifest: ManifestInstance<any>
  blocks: Blocks
  replica: Replica
  Storage: getStorage
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
