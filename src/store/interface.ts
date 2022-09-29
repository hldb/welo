import { Startable } from '@libp2p/interfaces/dist/src/startable'
import { CID } from 'multiformats/cid'
import { Replica } from '../database/replica'
import { ManifestInstance } from '../manifest/interface'
import { Registrant } from '../registry/registrant'

export interface Props {
  manifest: ManifestInstance<any>
  replica: Replica
}

export type Creator = (...args: any[]) => Promise<CID>

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
  new(props: Props): StoreInstance
}
