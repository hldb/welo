import * as Block from 'multiformats/block'
import * as cbor from '@ipld/dag-cbor'
import { sha256 } from 'multiformats/hashes/sha2'
import { IPFS } from 'ipfs'
import { CID } from 'multiformats/cid'

import type { AbortOptions } from 'ipfs-core-types'
import type { PreloadOptions } from 'ipfs-core-types/utils'
import type { MultihashHasher } from 'multiformats/hashes/hasher'
import type { PutOptions } from 'ipfs-core-types/block'

type Codec = typeof cbor

interface Codecs {
  [code: number]: Codec
}

const codecs: Codecs = {
  [cbor.code]: cbor
}

interface Names {
  [code: number]: string
}

const names: Names = {
  [cbor.code]: cbor.name
}

interface Hashers {
  [code: number]: Block.Hasher<'sha2-256'>
}

const hashers: Hashers = {
  [sha256.code]: sha256
}

const noIpfsError = (): Error => new Error('this.ipfs is undefined')

class IpfsBlocks {
  constructor (private readonly ipfs: IPFS) {}

  static async encode<T>({
    value,
    codec,
    hasher
  }: {
    value: T
    codec?: Block.BlockEncoder<number, T>
    hasher?: MultihashHasher<number>
  }): Promise<Block.Block<T>> {
    return await Block.encode<T, number, number>({
      value,
      codec: codec != null ? codec : cbor,
      hasher: hasher != null ? hasher : sha256
    })
  }

  static async decode<T>({
    bytes,
    codec,
    hasher
  }: {
    bytes: Block.ByteView<T>
    codec?: Block.BlockDecoder<number, T>
    hasher?: MultihashHasher<number>
  }): Promise<Block.Block<T>> {
    return await Block.decode<T, number, number>({
      bytes,
      codec: codec != null ? codec : cbor,
      hasher: hasher != null ? hasher : sha256
    })
  }

  async get (
    cid: CID,
    options?: (AbortOptions & PreloadOptions) | undefined
  ): Promise<Block.Block<any>> {
    if (this.ipfs === undefined) {
      throw noIpfsError()
    }

    const bytes = await this.ipfs.block.get(cid, options)

    return await Block.decode({
      bytes,
      codec: codecs[cid.code],
      hasher: hashers[cid.multihash.code]
    })
  }

  async put (
    block: Block.Block<any>,
    options?: PutOptions | undefined
  ): Promise<CID> {
    if (this.ipfs === undefined) {
      throw noIpfsError()
    }

    return await this.ipfs.block.put(block.bytes, {
      version: block.cid.version,
      format: names[block.cid.code],
      ...options
    })
  }

  get encode (): typeof IpfsBlocks.encode {
    return IpfsBlocks.encode
  }

  get decode (): typeof IpfsBlocks.decode {
    return IpfsBlocks.decode
  }
}

export { IpfsBlocks as Blocks }
