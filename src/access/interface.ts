import { Startable } from '@libp2p/interfaces/startable'

import { EntryInstance } from '../entry/interface'
import { Registrant } from '../registry/registrant'
import { ManifestInstance } from '../manifest/interface'
import { Implements } from '../decorators'

export interface AccessInstance extends Startable {
  canAppend: (entry: EntryInstance<any>) => Promise<boolean>
  close: () => Promise<void>
}

export interface Open {
  manifest: ManifestInstance<any>
}

export interface AccessStatic extends Implements<AccessInstance>, Registrant {}
