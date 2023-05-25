import { ShardBlock, put, get, del } from '@alanshaw/pail'
import { CID } from 'multiformats'
import { code } from 'multiformats/codecs/raw'
import { sha256 } from 'multiformats/hashes/sha2'
import drain from 'it-drain'
import PQueue from 'p-queue'
import { CodeError } from '@libp2p/interfaces/errors'
import { BaseDatastore } from 'datastore-core'
import type { ShardLink, ShardBlockView } from '@alanshaw/pail/shard'
import type { AnyLink } from '@alanshaw/pail/link'
import type { AnyBlock, BlockFetcher } from '@alanshaw/pail/block'
import type { BaseBlockstore } from 'blockstore-core'
import type { Key } from 'interface-datastore'
import type { Pair } from 'interface-blockstore'
import type { IpldDatastore } from './types'

export class Paily extends BaseDatastore implements IpldDatastore<ShardLink> {
  root: ShardLink
  readonly blockFetcher: BlockFetcher
  readonly #queue: PQueue

  constructor (
    readonly blocks: BaseBlockstore,
    root: ShardLink
  ) {
    super()
    this.root = root
    this.blockFetcher = blockFetcher(this.blocks)
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
    const link = await get(this.blockFetcher, this.root, key.toString())

    if (link == null) {
      throw new CodeError('Not Found', 'ERR_NOT_FOUND')
    }

    return await this.blocks.get(linkToCid(link))
  }

  async has (key: Key): Promise<boolean> {
    return Boolean(await get(this.blockFetcher, this.root, key.toString()))
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

const blockFetcher = (blockstore: BaseBlockstore): BlockFetcher => ({
  get: async (link): Promise<AnyBlock | undefined> => {
    try {
      const bytes = await blockstore.get(linkToCid(link))

      return { cid: link, bytes }
    } catch (e) {
      if (e instanceof CodeError && e?.code === 'ERR_NOT_FOUND') {
        return undefined
      }
      throw e
    }
  }
})

const linkToCid = (link: AnyLink): CID => {
  const cid = CID.asCID(link)

  if (cid == null) {
    throw new Error('Failed to turn link to cid.')
  }

  return cid
}

const toPair = ({ cid, bytes }: ShardBlockView): Pair => ({ cid, block: bytes })

async function unqueuedPut (this: Paily, key: Key, val: Uint8Array): Promise<Key> {
  const cid = CID.create(1, code, await sha256.digest(val))
  const { root: newRoot, additions, removals } = await put(
    this.blockFetcher,
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
    this.blockFetcher,
    this.root,
    key.toString()
  )

  await Promise.all([
    await drain(this.blocks.putMany(additions.map(toPair))),
    await drain(this.blocks.putMany(removals.map(toPair)))
  ])

  this.root = newRoot
}
