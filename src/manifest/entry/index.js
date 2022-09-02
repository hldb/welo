
import * as Block from 'multiformats/block'
import * as codec from '@ipld/dag-cbor'
import { sha256 as hasher } from 'multiformats/hashes/sha2'

const type = 'base'

class Entry {
  constructor ({ block, data, identity }) {
    this.block = block
    this.identity = identity

    Object.defineProperties(this, {
      cid: { get: () => block.cid },
      auth: { get: () => block.value.auth },
      sig: { get: () => block.value.sig },
      v: { get: () => data.value.v },
      tag: { get: () => data.value.tag },
      payload: { get: () => data.value.payload },
      next: { get: () => data.value.next },
      refs: { get: () => data.value.refs }
    })
  }

  static get type () { return type }

  static async create ({ identity, tag, payload, next, refs }) {
    const data = await Block.encode({
      value: { v: 1, tag, payload, next, refs },
      codec,
      hasher
    })
    const bytes = data.bytes

    const auth = identity.auth
    const sig = await identity.sign(bytes)

    const block = await Block.encode({
      value: { auth, data: bytes, sig },
      codec,
      hasher
    })

    return new Entry({ block, data, identity })
  }

  static async fetch ({ blocks, Identity, cid }) {
    const bytes = await blocks.get(cid)
    const block = await Block.decode({ bytes, codec, hasher })
    const { auth } = block.value
    const identity = await Identity.fetch({ blocks, auth })

    if (!await Entry.verify({ block, identity })) {
      throw new Error(`entry with cid: ${block.cid.toString()} has invalid signature`)
    }

    return this.asEntry({ block, identity })
  }

  static async asEntry (entry) {
    if (entry instanceof Entry) {
      return entry
    }

    const { block, identity } = entry
    const data = await Block.decode({ bytes: block.value.data, codec, hasher })

    return new Entry({ block, data, identity })
  }

  static async verify ({ block, identity }) {
    const { auth, data, sig } = block.value
    if (!auth.equals(identity.auth)) {
      return false
    }

    return identity.verify(data, sig)
  }
}

export { Entry }
