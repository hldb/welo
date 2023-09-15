import type { BlockView } from 'multiformats/interface'
import type { CID } from 'multiformats/cid'

import protocol from './protocol.js'
import { decodeCbor, encodeCbor } from '@/utils/block.js'

interface BlockData<Protocol> {
  protocol: Protocol
  database: CID
  heads: CID[]
}

type BlockDataP = BlockData<typeof protocol>

type BlockMessage = BlockView<BlockDataP>

export async function write (
  database: CID,
  heads: CID[]
): Promise<BlockMessage> {
  return await encodeCbor({ protocol, database, heads })
}

export async function read (bytes: Uint8Array): Promise<BlockMessage> {
  const block = await decodeCbor<BlockDataP>(bytes)

  if (block.value.protocol !== protocol) {
    throw new Error('wrong protocol')
  }

  return block
}
