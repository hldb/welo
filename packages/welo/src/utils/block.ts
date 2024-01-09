import * as Block from 'multiformats/block'
import * as codec from '@ipld/dag-cbor'
import { sha256 as hasher } from 'multiformats/hashes/sha2'
import type { BlockView, ByteView } from 'multiformats/interface'

type CborCode = typeof codec.code
type Sha256Code = typeof hasher.code

interface CborBlock<T> extends BlockView<T, CborCode, Sha256Code, 1> {}

export const encodeCbor = async <T>(value: T): Promise<CborBlock<T>> =>
  await Block.encode<T, CborCode, Sha256Code>({ value, codec, hasher })

export const decodeCbor = async <T>(bytes: ByteView<T>): Promise<CborBlock<T>> =>
  await Block.decode<T, CborCode, Sha256Code>({ bytes, codec, hasher })
