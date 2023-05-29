import type { Startable } from '@libp2p/interfaces/startable'

import type { EntryInstance } from '@/entry/interface.js'
import { HLDB_PREFIX } from '@/utils/constants.js'
import type { Component } from '@/interface.js'
import type { Manifest } from '@/manifest/index'

export interface AccessInstance extends Startable {
  canAppend: (entry: EntryInstance<any>) => Promise<boolean>
  close: () => Promise<void>
}

export interface Open {
  manifest: Manifest
}

export interface AccessComponent<T extends AccessInstance = AccessInstance, P extends string = string> extends Component<P> {
  create: (config: Open) => T
}

export const wildcard = '*'

export const prefix = `${HLDB_PREFIX}access/` as const
