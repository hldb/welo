import type { IdentityInstance, IdentityComponent } from '@/identity/interface.js'
import type { ComponentProtocol } from '@/interface.js'
import type { Blockstore } from 'interface-blockstore'
import type { AbortOptions } from 'interface-store'
import type { CID } from 'multiformats/cid'
import type { BlockView } from 'multiformats/interface'
import { HLDB_PREFIX } from '@/utils/constants.js'

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
  blockstore: Blockstore
  identity: IdentityComponent<any>
  cid: CID
}

export type AsEntry<Value> = Pick<EntryInstance<Value>, 'block' | 'identity'>

export interface EntryComponent<T extends EntryInstance<unknown> = EntryInstance<unknown>, P extends string = string> extends ComponentProtocol<P> {
  create(create: Create): Promise<T>
  fetch(fetch: Fetch, options?: AbortOptions): Promise<T>
  asEntry(entry: AsEntry<unknown>): Promise<T | null>
  verify(entry: AsEntry<unknown>): Promise<boolean>
}

export const prefix = `${HLDB_PREFIX}entry/` as const
