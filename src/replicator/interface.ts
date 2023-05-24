import type { Helia } from '@helia/interface'
import type { Libp2p } from 'libp2p'

import type { Replica } from '@/replica/index.js'
import type { Blocks } from '@/blocks/index.js'
import { OPALSNT_PREFIX } from '@/utils/constants.js'
import type { Playable } from '@/utils/playable.js'

export interface Config {
  ipfs: Helia
  libp2p: Libp2p
  replica: Replica
  blocks: Blocks
}

export interface Replicator extends Playable {}

export type ReplicatorClass = new (config: Config) => Replicator

export const prefix = `${OPALSNT_PREFIX}replicator/` as const
