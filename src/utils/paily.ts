import { ShardBlock, put, get, del } from '@alanshaw/pail'
import { CID } from 'multiformats/cid'
import { code } from 'multiformats/codecs/raw'
import { sha256 } from 'multiformats/hashes/sha2'
import drain from 'it-drain'
import PQueue from 'p-queue'
import { CodeError } from '@libp2p/interfaces/errors'
import { BaseDatastore } from 'datastore-core'
import type { ShardLink, ShardBlockView } from '@alanshaw/pail/shard'
import type { BlockFetcher } from '@alanshaw/pail/block'
import type { BaseBlockstore } from 'blockstore-core'
import type { Key } from 'interface-datastore'
import type { Pair } from 'interface-blockstore'

export class Paily extends BaseDatastore {
  root: ShardLink
  readonly #queue: PQueue

  constructor (
    readonly blocks: BaseBlockstore,
    root: ShardLink
  ) {
    super()
    this.root = root
    this.#queue = new PQueue({ concurrency: 1 })
  }

  static async empty (blocks: BaseBlockstore): Promise<Paily> {
    const { bytes, cid } = await ShardBlock.create()
    await blocks.put(cid, bytes)
    return new Paily(blocks, cid)
  }

  async idle (): Promise<void> {
    return await this.#queue.onIdle()
  }

  async get (key: Key): Promise<Uint8Array> {
    const link = await get(this.blocks as unknown as BlockFetcher, this.root, key.toString())

    if (link == null) {
      throw new CodeError('Not Found', 'ERR_NOT_FOUND')
    }

    return await this.blocks.get(CID.create(1, link.code, link?.multihash))
  }

  async has (key: Key): Promise<boolean> {
    return Boolean(await get(this.blocks as unknown as BlockFetcher, this.root, key.toString()))
  }

  async put (key: Key, val: Uint8Array): Promise<Key> {
    const resolved = await this.#queue.add(async () => await unqueuedPut.apply(this, [key, val]))

    if (resolved == null) {
      throw new CodeError('why tf this undefined', 'UNDEFINED')
    }

    return key
  }

  async delete (key: Key): Promise<void> {
    return await this.#queue.add(async () => await unqueuedDelete.apply(this, [key]))
  }
}

const toPair = ({ cid, bytes }: ShardBlockView): Pair => ({ cid, block: bytes })

async function unqueuedPut (this: Paily, key: Key, val: Uint8Array): Promise<Key> {
  const cid = CID.create(1, code, await sha256.digest(val))
  const { root: newRoot, additions, removals } = await put(
    this.blocks as unknown as BlockFetcher,
    this.root,
    key.toString(),
    cid
  )

  await Promise.all([
    await drain(this.blocks.putMany(additions.map(toPair).concat([{ cid, block: val }]))),
    await drain(this.blocks.putMany(removals.map(toPair)))
  ])

  this.root = newRoot

  return key
}

async function unqueuedDelete (this: Paily, key: Key): Promise<void> {
  const { root: newRoot, additions, removals } = await del(
    this.blocks as unknown as BlockFetcher,
    this.root,
    key.toString()
  )

  await Promise.all([
    await drain(this.blocks.putMany(additions.map(toPair))),
    await drain(this.blocks.putMany(removals.map(toPair)))
  ])

  this.root = newRoot
}
