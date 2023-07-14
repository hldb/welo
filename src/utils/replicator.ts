import all from 'it-all'
import { parsedcid } from '@/utils/index.js'
import { dagLinks, loadEntry, traverser } from '@/replica/traversal.js'
import { Heads } from '@/message/heads.js'
import { CID } from 'multiformats/cid'
import { BloomFilter } from 'fission-bloom-filters'
import type { DbComponents } from '@/interface.js'
import type { Replica } from '@/replica/index.js'

const filterSize = (length: number, rate: number): number =>
  Math.ceil(-((length * Math.log(rate)) / Math.pow(Math.log(2), 2)))

const filterHashes = (size: number, length: number): number =>
  Math.ceil((size / length) * Math.log(2))

export const getHeads = async (replica: Replica): Promise<CID[]> => {
  const keys = await all(replica.heads.queryKeys({}))

  return keys.map(key => parsedcid(key.baseNamespace()))
}

export const createFilter = async (replica: Replica, options: Partial<{ errorRate: number }> = {}): Promise<{ filter: Uint8Array, hashes: number }> => {
  const heads = await getHeads(replica)
  const size = filterSize(heads.length, options.errorRate ?? 0.1)
  const hashes = filterHashes(size, heads.length)
  const filter = new BloomFilter(size, hashes)

  return { filter: filter.toBytes(), hashes }
}

export const getDifference = async (replica: Replica, filter: Uint8Array, hashes: number): Promise<CID[]> => {
  const filterObj = BloomFilter.fromBytes(filter, hashes)
  const heads = await getHeads(replica)

  return heads.filter(h => !filterObj.has(h.bytes))
}

export const encodeHeads = (cids: CID[]): Uint8Array => {
  const rawCids = cids.map(cid => cid.bytes);

  return Heads.encode({ cids: rawCids })
}

export const decodeHeads = (bytes: Uint8Array): CID[] => {
  const heads = Heads.decode(bytes)

  return heads.cids.map(bytes => CID.decode(bytes))
}

export async function addHeads (
  cids: CID[],
  replica: Replica,
  components: Pick<DbComponents, 'entry' | 'identity'>
): Promise<void> {
  const load = loadEntry({
    blocks: replica.blocks,
    entry: components.entry,
    identity: components.identity
  })

  const links = dagLinks({
    access: replica.access,
    graph: replica.graph
  })

  const traversed = await traverser({ cids, load, links })
  await replica.add(traversed)
}
