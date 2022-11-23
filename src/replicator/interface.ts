import type { PeerId } from '@libp2p/interface-peer-id'
import type { IPFS } from 'ipfs'
import type { Libp2p } from 'libp2p'

import { Replica } from '~database/replica.js'
import { Blocks } from '~blocks/index.js'

export interface Config {
  peerId?: PeerId
  ipfs?: IPFS
  libp2p?: Libp2p
  web3storage?: any
  replica: Replica
  blocks: Blocks
}
