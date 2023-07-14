import all from 'it-all'
import { parsedcid } from '@/utils/index.js'
import { Blocks } from '@/blocks/index.js'
import { dagLinks, loadEntry, traverser } from '@/replica/traversal.js'
import type { DbComponents } from '@/interface.js'
import type { CID } from 'multiformats/cid'
import type { Replica } from '@/replica/index.js'

export const getHeads = async (replica: Replica): Promise<CID[]> => {
  const keys = await all(replica.heads.queryKeys({}))

  return keys.map(key => parsedcid(key.baseNamespace()))
}

export const encodeHeads = async (cids: CID[]): Promise<Uint8Array> => {
  const block = await Blocks.encode({ value: cids })

  return block.bytes
}

export const decodeHeads = async (bytes: Uint8Array): Promise<CID[]> => {
  const block = await Blocks.decode<CID[]>({ bytes })

  return block.value
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
