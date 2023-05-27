import type { BlockView } from 'multiformats/interface'
import type { CID } from 'multiformats/cid'

import { Blocks } from '@/blocks/index.js'
import type { IdentityInstance } from '@/identity/interface.js'

import protocol from './protocol.js'
import type {
  EntryData,
  EntryInstance,
  EntryModule,
  Create,
  Fetch,
  AsEntry
} from '../interface.js'

interface SignedEntry {
  auth: CID
  data: Uint8Array
  sig: Uint8Array
}

export class Entry implements EntryInstance<SignedEntry>, EntryData {
  readonly identity: IdentityInstance<any>
  readonly block: BlockView<SignedEntry>

  readonly cid: CID
  readonly auth: CID
  readonly sig: Uint8Array

  readonly tag: Uint8Array
  readonly payload: any
  readonly next: CID[]
  readonly refs: CID[]

  constructor ({
    block,
    data,
    identity
  }: {
    block: BlockView<SignedEntry>
    data: BlockView<EntryData>
    identity: IdentityInstance<any>
  }) {
    this.identity = identity
    this.block = block

    this.cid = block.cid
    this.auth = block.value.auth
    this.sig = block.value.sig

    this.tag = data.value.tag
    this.payload = data.value.payload
    this.next = data.value.next
    this.refs = data.value.refs
  }
}

const verify = async (entry: AsEntry<unknown>): Promise<boolean> => {
  const parsedEntry = await asEntry(entry)

  if (parsedEntry == null) {
    return false
  }

  const { block, identity } = parsedEntry
  const { auth, data, sig } = block.value

  return auth.equals(identity.auth) && (await identity.verify(data, sig))
}

const asEntry = async (entry: AsEntry<unknown>): Promise<Entry | null> => {
  if (entry instanceof Entry) {
    return entry
  }

  const { block, identity } = entry

  if (block.value == null || typeof block.value !== 'object') {
    return null
  }

  const asPartial = block as BlockView<Partial<SignedEntry>>

  if (asPartial.value.auth == null || asPartial.value.data == null || asPartial.value.sig == null) {
    return null
  }

  const asSigned = block as BlockView<SignedEntry>

  const data: BlockView<EntryData> = await Blocks.decode({
    bytes: asSigned.value.data
  })

  return new Entry({ block: asSigned, data, identity })
}

const fetch = async ({ blocks, identityModule, cid }: Fetch): Promise<Entry> => {
  const block: BlockView<SignedEntry> = await blocks.get<SignedEntry>(cid)
  const { auth } = block.value
  const identity = await identityModule.fetch({ blocks, auth })

  const entry = await asEntry({ block, identity })

  if (entry === null) {
    throw new Error('cid did not resolve to a valid entry')
  }

  if (!(await verify(entry))) {
    throw new Error(`entry with cid: ${block.cid.toString()} has invalid signature`)
  }

  return entry
}

const create = async ({
  identity,
  tag,
  payload,
  next,
  refs
}: Create): Promise<Entry> => {
  const data: BlockView<EntryData> = await Blocks.encode({
    value: { tag, payload, next, refs }
  })

  const auth = identity.auth
  const sig = await identity.sign(data.bytes)

  const block: BlockView<SignedEntry> = await Blocks.encode({
    value: { auth, data: data.bytes, sig }
  })

  return new Entry({ block, data, identity })
}

export const createBasalEntry: () => EntryModule<Entry, typeof protocol> = () => ({
  protocol,
  create,
  fetch,
  asEntry,
  verify
})
