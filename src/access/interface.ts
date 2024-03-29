import type { EntryInstance } from '@/entry/interface.js'
import type { ComponentProtocol } from '@/interface.js'
import type { Manifest } from '@/manifest/index'
import type { Startable } from '@libp2p/interfaces/startable'
import { HLDB_PREFIX } from '@/utils/constants.js'

export interface AccessInstance extends Startable {
  canAppend(entry: EntryInstance<any>): Promise<boolean>
  close(): Promise<void>
}

export interface Open {
  manifest: Manifest
}

export interface AccessComponent<T extends AccessInstance = AccessInstance, P extends string = string> extends ComponentProtocol<P> {
  create(config: Open): T
}

export const wildcard = '*'

export const prefix = `${HLDB_PREFIX}access/` as const
