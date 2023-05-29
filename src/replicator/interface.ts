import type { GossipHelia, Component } from '@/interface.js'
import type { Replica } from '@/replica/index.js'
import type { Blocks } from '@/blocks/index.js'
import { HLDB_PREFIX } from '@/utils/constants.js'
import type { Playable } from '@/utils/playable.js'

export interface Config {
  ipfs: GossipHelia
  replica: Replica
  blocks: Blocks
}

export interface Replicator extends Playable {}

export interface ReplicatorModule<T extends Replicator = Replicator, P extends string = string> extends Component<P> {
  create: (config: Config) => T
}

export const prefix = `${HLDB_PREFIX}replicator/` as const
