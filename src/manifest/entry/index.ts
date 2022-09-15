import { Block } from 'multiformats/block.js'
import { CID } from 'multiformats/cid.js'
import { Blocks } from '../../mods/blocks.js'
import { Identity } from '../identity/index.js'
import { ComponentConfig } from '../interfaces.js'
type IdentityType = typeof Identity

const type = '/opal/entry/base'

export type EntryConfig = ComponentConfig<typeof type>

export interface EntryData {
  tag: Uint8Array
  payload: any
  next: CID[]
  refs: CID[]
}

export type EntryDataBlock = Block<EntryData>

export interface CreateParams extends EntryData {
  identity: Identity
}

interface SignedEntry {
  auth: CID
  data: Uint8Array
  sig: Uint8Array
}

export type SignedEntryBlock = Block<SignedEntry>

class Entry {
  readonly block: SignedEntryBlock
  readonly identity: Identity

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
    block: SignedEntryBlock
    data: EntryDataBlock
    identity: Identity
  }) {
    this.block = block
    this.identity = identity

    this.cid = block.cid
    this.auth = block.value.auth
    this.sig = block.value.sig

    this.tag = data.value.tag
    this.payload = data.value.payload
    this.next = data.value.next
    this.refs = data.value.refs

    Object.defineProperties(this, {
      cid: { get: () => block.cid },
      auth: { get: () => block.value.auth },
      sig: { get: () => block.value.sig },
      tag: { get: () => data.value.tag },
      payload: { get: () => data.value.payload },
      next: { get: () => data.value.next },
      refs: { get: () => data.value.refs }
    })
  }

  static get type (): typeof type {
    return type
  }

  static async create ({
    identity,
    tag,
    payload,
    next,
    refs
  }: CreateParams): Promise<Entry> {
    const data: EntryDataBlock = await Blocks.encode({
      value: { tag, payload, next, refs }
    })
    const bytes = data.bytes

    const auth = identity.auth
    const sig = await identity.sign(bytes)

    const block: SignedEntryBlock = await Blocks.encode({
      value: { auth, data: bytes, sig }
    })

    return new Entry({ block, data, identity })
  }

  static async fetch ({
    blocks,
    Identity,
    cid
  }: {
    blocks: Blocks
    Identity: IdentityType
    cid: CID
  }): Promise<Entry> {
    const block: SignedEntryBlock = await blocks.get(cid)
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

  static async asEntry (
    entry: Entry | { block: SignedEntryBlock, identity: Identity }
  ): Promise<Entry | null> {
    if (entry instanceof Entry) {
      return entry
    }

    const { block, identity } = entry
    const data: EntryDataBlock = await Blocks.decode({
      bytes: block.value.data
    })

    return new Entry({ block, data, identity })
  }

  static async verify ({
    block,
    identity
  }: {
    block: SignedEntryBlock
    identity: Identity
  }): Promise<boolean> {
    const { auth, data, sig } = block.value

    return (
      auth.equals(identity.auth) === true && (await identity.verify(data, sig))
    )
  }
}

export { Entry }
