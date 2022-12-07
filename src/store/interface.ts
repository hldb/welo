import type { Startable } from '@libp2p/interfaces/startable'
import type { EventEmitter } from '@libp2p/interfaces/events'

import type { Replica } from '~replica/index.js'
import type { Manifest } from '~manifest/index.js'
import type { Blocks } from '~blocks/index.js'
import type { DatastoreClass } from '~utils/datastore.js'
import type { Registrant } from '~utils/register.js'

export interface Props {
  manifest: Manifest
  directory: string
  blocks: Blocks
  replica: Replica
  Datastore: DatastoreClass
}

export type Creator = (...args: any[]) => any

export type Selector = (state: any) => (...args: any[]) => any

export interface Events {
  update: CustomEvent<undefined>
}

export interface StoreInstance extends Startable {
  creators: {
    [key: string]: Creator
  }
  selectors: {
    [key: string]: Selector
  }
  latest: () => Promise<any>
  events: EventEmitter<Events>
}

export interface StoreStatic extends Registrant {
  new (props: Props): StoreInstance
}
