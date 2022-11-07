import { Block } from 'multiformats/block'
import { CID } from 'multiformats/cid'

import { Blocks } from '../mods/blocks.js'
import { Registrant } from '../registry/registrant.js'
import { IdentityInstance, IdentityStatic } from '../identity/interface.js'

export interface EntryData {
  tag: Uint8Array
  payload: any
  next: CID[]
  refs: CID[]
}

export interface EntryInstance<Value> extends EntryData {
  readonly block: Block<Value>
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

export type AsEntry<Value> =
  | EntryInstance<Value>
  | { block: Block<Value>, identity: IdentityInstance<any> }

export interface EntryStatic<Value> extends Registrant {
  new (props: any): EntryInstance<Value>
  create: (create: Create) => Promise<EntryInstance<Value>>
  fetch: (fetch: Fetch) => Promise<EntryInstance<Value>>
  asEntry: (entry: AsEntry<Value>) => Promise<EntryInstance<Value> | null>
  verify: (entry: EntryInstance<Value>) => Promise<boolean>
}
