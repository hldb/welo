import type { IPFS } from 'ipfs-core-types'
import type { Libp2p } from 'libp2p'

import type { Replica } from '~database/replica.js'
import type { Blocks } from '~blocks/index.js'

export interface Config {
  ipfs?: IPFS
  libp2p?: Libp2p
  web3storage?: any
  replica: Replica
  blocks: Blocks
}
