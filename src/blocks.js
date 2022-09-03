
import * as Block from 'multiformats/block'
import * as cbor from '@ipld/dag-cbor'
import { sha256 } from 'multiformats/hashes/sha2'

const codecs = {
  [cbor.code]: cbor
}

const names = {
  [cbor.code]: cbor.name
}

const hashers = {
  [sha256.code]: sha256
}

class IpfsBlocks {
  constructor (ipfs) {
    this.ipfs = ipfs
  }

  static async encode ({ value, codec, hasher }) {
    return Block.encode({
      value,
      codec: codec || cbor,
      hasher: hasher || sha256
    })
  }

  static async decode ({ bytes, codec, hasher }) {
    return Block.decode({
      bytes,
      codec: codec || cbor,
      hasher: hasher || sha256
    })
  }

  async get (cid, opts) {
    const bytes = await this.ipfs.block.get(cid, opts)

    return Block.decode({
      bytes,
      codec: codecs[cid.code],
      hasher: hashers[cid.multihash.code]
    })
  }

  async put (block, opts) {
    return this.ipfs.block.put(
      block.bytes,
      {
        version: block.cid.version,
        format: names[block.cid.code],
        ...opts
      }
    )
  }

  get encode () {
    return this.constructor.encode
  }

  get decode () {
    return this.constructor.decode
  }
}

export { IpfsBlocks as Blocks }
