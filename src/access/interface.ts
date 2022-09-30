import { Startable } from '@libp2p/interfaces/startable'

import { EntryInstance } from '../entry/interface.js'
import { Registrant } from '../registry/registrant.js'
import { ManifestInstance } from '../manifest/interface.js'

export interface AccessInstance extends Startable {
  canAppend: (entry: EntryInstance<any>) => Promise<boolean>
  close: () => Promise<void>
}

export interface Open {
  manifest: ManifestInstance<any>
}

export interface AccessStatic extends Registrant {
  new(props: any): AccessInstance
}
