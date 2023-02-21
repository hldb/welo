import type { IPFS } from 'ipfs-core-types'
import type { Libp2p } from 'libp2p'

import type { Replica } from '~replica/index.js'
import type { Blocks } from '~blocks/index.js'
import type { Playable } from '~utils/playable.js'

export interface Config {
  ipfs?: IPFS
  libp2p?: Libp2p
  web3storage?: any
  replica: Replica
  blocks: Blocks
}

export interface Replicator extends Playable {}

export type ReplicatorClass = new (config: Config) => Replicator
