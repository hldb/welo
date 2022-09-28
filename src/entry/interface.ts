import { Block } from 'multiformats/block'
import { CID } from 'multiformats/cid'
import { Blocks } from '../mods/blocks'
import { Identity } from '../identity/default'
import { Registrant } from '../registry/registrant'

export interface EntryData {
  tag: Uint8Array
  payload: any
  next: CID[]
  refs: CID[]
}

export interface EntryInstance<Value> extends EntryData {
  readonly block: Block<Value>
  readonly identity: Identity
  readonly cid: CID
}

export interface Create extends EntryData {
  identity: Identity
}

export interface Fetch {
  blocks: Blocks
  Identity: typeof Identity
  cid: CID
}

export type AsEntry<Value> = EntryInstance<Value> | { block: Block<Value>, identity: Identity }

export interface EntryStatic<Value> extends Registrant {
  new(props: any): EntryInstance<Value>
  create: (create: Create) => Promise<EntryInstance<Value>>
  fetch: (fetch: Fetch) => Promise<EntryInstance<Value>>
  asEntry: (entry: AsEntry<Value>) => Promise<EntryInstance<Value> | null>
  verify: (entry: EntryInstance<Value>) => Promise<boolean>
}
