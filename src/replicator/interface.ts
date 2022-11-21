import type { IPFS } from 'ipfs'
import type { PeerId } from '@libp2p/interface-peer-id'
import type { PubSub } from '@libp2p/interface-pubsub'

import { Replica } from '~database/replica.js'
import { Blocks } from '~blocks/index.js'

export interface Config {
  ipfs?: IPFS
  pubsub?: PubSub
  peerId?: PeerId
  web3storage?: any
  replica: Replica
  blocks: Blocks
}
