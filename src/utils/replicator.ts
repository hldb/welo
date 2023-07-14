import all from 'it-all'
import { parsedcid } from '@/utils/index.js'
import { dagLinks, loadEntry, traverser } from '@/replica/traversal.js'
import { Heads } from '@/message/heads.js'
import { CID } from 'multiformats/cid'
import type { DbComponents } from '@/interface.js'
import type { Replica } from '@/replica/index.js'

export const getHeads = async (replica: Replica): Promise<CID[]> => {
  const keys = await all(replica.heads.queryKeys({}))

  return keys.map(key => parsedcid(key.baseNamespace()))
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
