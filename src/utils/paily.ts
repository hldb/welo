import { ShardBlock, put, get, del, entries } from '@alanshaw/pail'
import { CID } from 'multiformats'
import { code } from 'multiformats/codecs/raw'
import { sha256 } from 'multiformats/hashes/sha2'
import drain from 'it-drain'
import PQueue from 'p-queue'
import { CodeError } from '@libp2p/interfaces/errors'
import { difference, type CombinedDiff } from '@alanshaw/pail/diff'
import { BaseDatastore } from 'datastore-core'
import { Datastore, Key, Query, Pair as DatastorePair } from 'interface-datastore'
import type { ShardLink, ShardBlockView } from '@alanshaw/pail/shard'
import type { AnyLink } from '@alanshaw/pail/link'
import type { AnyBlock, BlockFetcher } from '@alanshaw/pail/block'
import type { Blockstore, Pair as BlockstorePair } from 'interface-blockstore'
import type { Await } from '@helia/interface'

export interface IpldDatastore<L extends AnyLink = AnyLink> extends Datastore {
  root: L
  diff: (link: L) => Await<CombinedDiff>
}

export class Paily extends BaseDatastore implements IpldDatastore<ShardLink> {
  root: ShardLink
  readonly blockFetcher: BlockFetcher
  readonly #queue: PQueue

  constructor (
    readonly blockstore: Blockstore,
    root: ShardLink
  ) {
    super()
    this.root = root
    this.blockFetcher = blockFetcher(this.blockstore)
    this.#queue = new PQueue({ concurrency: 1 })
  }

  static async create (blockstore: Blockstore): Promise<Paily> {
    const { bytes, cid } = await ShardBlock.create()
    await blockstore.put(cid, bytes)
    return new Paily(blockstore, cid)
  }

  static open (blocks: Blockstore, root: ShardLink): Paily {
    return new Paily(blocks, root)
  }

  async get (key: Key): Promise<Uint8Array> {
    const link = await get(this.blockFetcher, this.root, key.toString())

    if (link == null) {
      throw new CodeError('Not Found', 'ERR_NOT_FOUND')
    }

    return await this.blockstore.get(linkToCid(link))
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

  async * _all (query: Query): AsyncIterable<DatastorePair> {
    for await (const entry of entries(this.blockFetcher, this.root)) {
      yield { key: new Key(entry[0]), value: await this.blockstore.get(entry[1] as CID) }
    }
  }

  async * _allKeys (): AsyncIterable<Key> {
    for await (const entry of entries(this.blockFetcher, this.root)) {
      yield new Key(entry[0])
    }
  }

  async diff (link: ShardLink): Promise<CombinedDiff> {
    return await difference(this.blockFetcher, this.root, link)
  }
}

const blockFetcher = (blockstore: Blockstore): BlockFetcher => ({
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

const toPair = ({ cid, bytes }: ShardBlockView): BlockstorePair => ({ cid, block: bytes })

async function unqueuedPut (this: Paily, key: Key, val: Uint8Array): Promise<Key> {
  const cid = CID.create(1, code, await sha256.digest(val))
  const { root: newRoot, additions/** , removals */ } = await put(
    this.blockFetcher,
    this.root,
    key.toString(),
    cid
  )

  // worried about losing access to blocks during replica.traverse
  // will look at doing this by unpinning the blocks or the root in the future
  // await Promise.all([
  //   await drain(this.blocks.putMany(additions.map(toPair).concat([{ cid, block: val }]))),
  //   await drain(this.blocks.putMany(removals.map(toPair)))
  // ])
  await drain(this.blockstore.putMany(additions.map(toPair).concat([{ cid, block: val }])))

  this.root = newRoot

  return key
}

async function unqueuedDelete (this: Paily, key: Key): Promise<void> {
  const { root: newRoot, additions/** , removals */ } = await del(
    this.blockFetcher,
    this.root,
    key.toString()
  )

  // worried about losing access to blocks during replica.traverse
  // will look at doing this by unpinning the blocks or the root in the future
  // await Promise.all([
  //   await drain(this.blocks.putMany(additions.map(toPair))),
  //   await drain(this.blocks.putMany(removals.map(toPair)))
  // ])
  await drain(this.blockstore.putMany(additions.map(toPair)))

  this.root = newRoot
}
