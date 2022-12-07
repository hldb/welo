import type { Startable } from '@libp2p/interfaces/startable'

import type { EntryInstance } from '~entry/interface.js'
import type { Registrant } from '~utils/register.js'
import type { Manifest } from '~manifest/index'

export interface AccessInstance extends Startable {
  canAppend: (entry: EntryInstance<any>) => Promise<boolean>
  close: () => Promise<void>
}

export interface Open {
  manifest: Manifest
}

export interface AccessStatic extends Registrant {
  new (props: any): AccessInstance
}
