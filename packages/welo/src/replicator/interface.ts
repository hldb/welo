import type { ComponentProtocol } from '@/interface.js'
import type { Replica } from '@/replica/index.js'
import { HLDB_PREFIX } from '@/utils/constants.js'
import type { Playable } from '@/utils/playable.js'
import type { Datastore } from 'interface-datastore'
import type { Blockstore } from 'interface-blockstore'
import type { Ed25519PeerId } from '@libp2p/interface/peer-id'

export interface Config {
  peerId: Ed25519PeerId
  replica: Replica
  datastore: Datastore
  blockstore: Blockstore
}

export interface Replicator extends Playable {}

export interface ReplicatorModule<T extends Replicator = Replicator, P extends string = string> extends ComponentProtocol<P> {
  create: (config: Config) => T
}

export const prefix = `${HLDB_PREFIX}replicator/` as const
