import type { BlockView } from 'multiformats/interface'
import type { CID } from 'multiformats/cid'

import { Blocks } from '~/blocks/index.js'

import { protocol } from './protocol.js'

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
  return await Blocks.encode({ value: { protocol, database, heads } })
}

export async function read (bytes: Uint8Array): Promise<BlockMessage> {
  const block = await Blocks.decode<BlockDataP>({ bytes })

  if (block.value.protocol !== protocol) {
    throw new Error('wrong protocol')
  }

  return block
}
