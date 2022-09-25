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

export interface Instance<BlockValue> extends EntryData {
  readonly block: Block<BlockValue>
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

export type AsEntry<BlockValue> = Instance<BlockValue> | { block: Block<BlockValue>, identity: Identity }

export interface Static<BlockValue> extends Registrant<Instance<BlockValue>> {
  create: (create: Create) => Promise<Instance<BlockValue>>
  fetch: (fetch: Fetch) => Promise<Instance<BlockValue>>
  asEntry: (entry: AsEntry<BlockValue>) => Promise<Instance<BlockValue> | null>
  verify: (entry: Instance<BlockValue>) => Promise<boolean>
}
