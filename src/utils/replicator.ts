import all from 'it-all'
import { parsedcid } from '@/utils/index.js'
import { Blocks } from '@/blocks/index.js'
import { dagLinks, loadEntry, traverser } from '@/replica/traversal.js'
import type { AccessInstance } from '@/access/interface.js'
import type { EntryComponent } from '@/entry/interface.js'
import type { IdentityComponent } from '@/identity/interface.js'
import type { BlockView } from 'multiformats/interface'
import type { CID } from 'multiformats/cid'
import type { Replica } from '@/replica/index.js'
import type { Manifest } from '@/manifest/index.js'

export interface Heads {
  database: CID
  heads: CID[]
}

export const getHeads = async (replica: Replica, manifest: Manifest): Promise<Heads> => {
	const keys = await all(replica.heads.queryKeys({}))
	const heads: CID[] = keys.map(key => parsedcid(key.baseNamespace()))

	return { database: manifest.address.cid, heads }
}

export const encodeHeads = async (heads: Heads): Promise<Uint8Array> => {
	const block = await Blocks.encode({ value: heads })

	return block.bytes;
}

export const decodeHeads = async (bytes: Uint8Array): Promise<Heads> => {
	const block = await Blocks.decode<BlockView<Heads>>({ bytes })

	return block.value.value;
}

export async function addHeads (heads: Heads, components: {
	replica: Replica,
	access: AccessInstance,
	blocks: Blocks,
	entry: EntryComponent,
	identity: IdentityComponent
}): Promise<void> {
	const cids = heads.heads

	const load = loadEntry({
		blocks: components.blocks,
		entry: components.entry,
		identity: components.identity
	})

	const links = dagLinks({
		access: components.access,
		graph: components.replica.graph
	})

	const traversed = await traverser({ cids, load, links })
	await components.replica.add(traversed)
}
