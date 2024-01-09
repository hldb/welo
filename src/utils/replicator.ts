import all from 'it-all'
import { CID } from 'multiformats/cid'
import * as raw from 'multiformats/codecs/raw'
import { sha256 } from 'multiformats/hashes/sha2'
import { concat, compare } from 'uint8arrays'
import type { DbComponents } from '@/interface.js'
import type { Replica } from '@/replica/index.js'
import { dagLinks, loadEntry, traverser } from '@/replica/traversal.js'
import { parsedcid } from '@/utils/index.js'

export const getHeads = async (replica: Replica): Promise<CID[]> => {
  const keys = await all(replica.heads.queryKeys({}))

  return keys.map(key => parsedcid(key.baseNamespace()))
}

export const hashHeads = async (cids: CID[]): Promise<CID> => {
  const asBytes = cids.map(c => c.bytes).sort(compare)
  const bytes = concat(asBytes)

  const hash = await sha256.digest(bytes)

  return CID.createV1(raw.code, hash)
}

export async function addHeads (
  cids: CID[],
  replica: Replica,
  components: Pick<DbComponents, 'entry' | 'identity'>
): Promise<void> {
  const load = loadEntry({
    blockstore: replica.blockstore,
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
