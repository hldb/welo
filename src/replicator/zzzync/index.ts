import W3NameService from 'w3name/service'
import { zzzync, type Zzzync } from '@tabcat/zzzync'
import { namer, revisionState, type RevisionState } from '@tabcat/zzzync/namers/w3'
import { advertiser, CreateEphemeralLibp2p, Libp2pWithDHT } from '@tabcat/zzzync/advertisers/dht'

import { Playable } from '@/utils/playable.js'
import type { Replica } from '@/replica/index.js'
import type { Blocks } from '@/blocks/index.js'

import protocol from './protocol'
import type { Config, ReplicatorModule } from '../interface.js'

export class ZzzyncReplicator extends Playable {
  readonly replica: Replica
  readonly blocks: Blocks
  #zync: Zzzync

  constructor ({ replica, blocks, ipfs, datastore, options }: Config & { options: Options }) {
    const starting = async (): Promise<void> => {}
    const stopping = async (): Promise<void> => {}
    super({ starting, stopping })
    if (ipfs.libp2p.services.dht == null) {
      throw new Error()
    }

    this.replica = replica
    this.blocks = blocks

    const service = options.service ?? new W3NameService()
    const revisions = options.revisions ?? revisionState(datastore)
    if (options.createEphemeralLibp2p == null) {
      throw new Error('need createEphemeralLibp2p function to be supplied')
    }

    if (ipfs.libp2p.services.dht == null) {
      throw new Error('zzzync replicator needs the dht')
    }
    const libp2p = ipfs.libp2p as unknown as Libp2pWithDHT

    this.#zync = zzzync(
      namer(service, revisions),
      advertiser(libp2p, options.createEphemeralLibp2p)
    )
  }

  async advertise (): Promise<void> {}

  async search (): Promise<void> {}
}

interface Options {
  service?: W3NameService
  revisions?: RevisionState
  createEphemeralLibp2p: CreateEphemeralLibp2p
}

export const zzzyncReplicator: (options: Options) => ReplicatorModule<ZzzyncReplicator, typeof protocol> =
(options) => ({
  protocol,
  create: (config: Config) => new ZzzyncReplicator({ ...config, options })
})
