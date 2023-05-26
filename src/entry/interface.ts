import type { BlockView } from 'multiformats/interface'
import type { CID } from 'multiformats/cid'

import type { Blocks } from '@/blocks/index.js'
import { HLDB_PREFIX } from '@/utils/constants.js'
import type { Module } from '@/interface.js'
import type { IdentityInstance, IdentityStatic } from '@/identity/interface.js'

export interface EntryData {
  tag: Uint8Array
  payload: any
  next: CID[]
  refs: CID[]
}

export interface EntryInstance<Value> extends EntryData {
  readonly block: BlockView<Value>
  readonly identity: IdentityInstance<any>
  readonly cid: CID
}

export interface Create extends EntryData {
  identity: IdentityInstance<any>
}

export interface Fetch {
  blocks: Blocks
  Identity: IdentityStatic<any>
  cid: CID
  timeout?: number
}

export type AsEntry<Value> = Pick<EntryInstance<Value>, 'block' | 'identity'>

export interface EntryModule<T extends EntryInstance<unknown> = EntryInstance<unknown>, P extends string = string> extends Module<P> {
  create: (create: Create) => Promise<T>
  fetch: (fetch: Fetch) => Promise<T>
  asEntry: (entry: AsEntry<unknown>) => Promise<T | null>
  verify: (entry: AsEntry<unknown>) => Promise<boolean>
}

export const prefix = `${HLDB_PREFIX}entry/` as const
