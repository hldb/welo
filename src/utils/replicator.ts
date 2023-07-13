import all from 'it-all'
import { parsedcid } from '@/utils/index.js'
import { Blocks } from '@/blocks/index.js'
import { dagLinks, loadEntry, traverser } from '@/replica/traversal.js'
import type { DbComponents } from '@/interface.js'
import type { CID } from 'multiformats/cid'
import type { Replica } from '@/replica/index.js'

export interface Heads {
  database: CID
  heads: CID[]
}

export const getHeads = async (replica: Replica): Promise<Heads> => {
  const keys = await all(replica.heads.queryKeys({}))
  const heads: CID[] = keys.map(key => parsedcid(key.baseNamespace()))

  return { database: replica.manifest.address.cid, heads }
}

export const encodeHeads = async (heads: Heads): Promise<Uint8Array> => {
  const block = await Blocks.encode({ value: heads })

  return block.bytes
}

export const decodeHeads = async (bytes: Uint8Array): Promise<Heads> => {
  const block = await Blocks.decode<Heads>({ bytes })

  return block.value
}

export async function addHeads (
  heads: Heads,
  replica: Replica,
  components: Pick<DbComponents, 'entry' | 'identity'>
): Promise<void> {
  const cids = heads.heads

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
