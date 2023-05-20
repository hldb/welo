import type { BlockView } from 'multiformats/interface'
import type { CID } from 'multiformats/cid'

import { Blocks } from '~/blocks/index.js'
import { Extends } from '~/utils/decorators.js'
import type { IdentityInstance } from '~/identity/interface.js'

import protocol from './protocol.js'
import type {
  EntryData,
  EntryInstance,
  EntryStatic,
  Create,
  Fetch,
  AsEntry
} from '../interface.js'

interface SignedEntry {
  auth: CID
  data: Uint8Array
  sig: Uint8Array
}

@Extends<EntryStatic<SignedEntry>>()
export class Entry implements EntryInstance<SignedEntry> {
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

  static get protocol (): string {
    return protocol
  }

  static async create ({
    identity,
    tag,
    payload,
    next,
    refs
  }: Create): Promise<Entry> {
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

  static async fetch ({ blocks, Identity, cid }: Fetch): Promise<Entry> {
    const block: BlockView<SignedEntry> = await blocks.get<SignedEntry>(cid)
    const { auth } = block.value
    const identity = await Identity.fetch({ blocks, auth })

    const entry = await this.asEntry({ block, identity })
    if (entry === null) {
      throw new Error('cid did not resolve to a valid entry')
    }

    if (!(await Entry.verify({ block, identity }))) {
      throw new Error(
        `entry with cid: ${block.cid.toString()} has invalid signature`
      )
    }

    return entry
  }

  static async asEntry (entry: AsEntry<SignedEntry>): Promise<Entry | null> {
    if (entry instanceof Entry) {
      return entry
    }

    const { block, identity } = entry
    const data: BlockView<EntryData> = await Blocks.decode({
      bytes: block.value.data
    })

    return new Entry({ block, data, identity })
  }

  static async verify ({
    block,
    identity
  }: {
    block: BlockView<SignedEntry>
    identity: IdentityInstance<any>
  }): Promise<boolean> {
    const { auth, data, sig } = block.value

    return auth.equals(identity.auth) && (await identity.verify(data, sig))
  }
}
