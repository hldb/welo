import { encode, decode } from 'multiformats/block'
import * as cbor from '@ipld/dag-cbor'
import { sha256 } from 'multiformats/hashes/sha2'
import type { IPFS, AbortOptions } from 'ipfs-core-types'
import type { PreloadOptions } from 'ipfs-core-types/src/utils'
import type { CID } from 'multiformats/cid'
import type { PutOptions } from 'ipfs-core-types/src/block'
import type {
  ByteView,
  BlockView,
  MultihashHasher,
  BlockEncoder,
  BlockDecoder
} from 'multiformats/interface'

interface Codecs {
  [code: number]: typeof cbor
}

const codecs: Codecs = {
  [cbor.code]: cbor
}

interface Names {
  [code: number]: typeof cbor.name
}

const names: Names = {
  [cbor.code]: cbor.name
}

interface Hashers {
  [code: number]: typeof sha256
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
    codec?: BlockEncoder<number, T>
    hasher?: MultihashHasher<number>
  }): Promise<BlockView<T, number, number, 1>> {
    return await encode<T, number, number>({
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
    bytes: ByteView<T>
    codec?: BlockDecoder<number, T>
    hasher?: MultihashHasher<number>
  }): Promise<BlockView<T, number, number, 1>> {
    return await decode<T, number, number>({
      bytes,
      codec: codec != null ? codec : cbor,
      hasher: hasher != null ? hasher : sha256
    })
  }

  async get<T>(
    cid: CID<T>,
    options?: (AbortOptions & PreloadOptions)
  ): Promise<BlockView<T, number, number, 1>> {
    if (this.ipfs === undefined) {
      throw noIpfsError()
    }

    if (cid.version === 0) {
      throw new Error('cid.version 0 is not supported')
    }

    const codec = codecs[cid.code]
    if (codec == null) {
      throw new Error('codec not available')
    }

    const hasher = hashers[cid.multihash.code]
    if (hasher == null) {
      throw new Error('hasher not availabe')
    }

    const bytes = await this.ipfs.block.get(cid, options)

    return await decode<T, number, number>({
      bytes,
      codec,
      hasher
    })
  }

  async put<T>(
    block: BlockView<T>,
    options?: PutOptions
  ): Promise<CID<T, number, number, 1>> {
    if (this.ipfs === undefined) {
      throw noIpfsError()
    }

    // @ts-expect-error
    if (block.cid.version === 0) {
      throw new Error('cid.version 0 no supported')
    }

    const format = names[block.cid.code]
    if (format == null) {
      throw new Error('unsupported codec')
    }

    const cid = await this.ipfs.block.put(block.bytes, {
      format,
      ...options,
      version: block.cid.version
    })

    return cid as CID<T, number, number, 1>
  }

  get encode (): typeof IpfsBlocks.encode {
    return IpfsBlocks.encode
  }

  get decode (): typeof IpfsBlocks.decode {
    return IpfsBlocks.decode
  }
}

export { IpfsBlocks as Blocks }
