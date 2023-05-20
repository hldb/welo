import { start, stop } from '@libp2p/interfaces/startable'

import { Register } from '~/utils/register.js'
import { Playable } from '~/utils/playable.js'
import { Extends } from '~/utils/decorators.js'

import { replicatorPrefix } from '../prefix.js'
import type { Replicator, ReplicatorClass, Config } from '../interface.js'

const register = new Register<ReplicatorClass>(replicatorPrefix)

@Extends<ReplicatorClass>()
export class MultiReplicator extends Playable implements Replicator {
  static get register (): Register<ReplicatorClass> {
    return register
  }

  readonly config: Config
  readonly replicators: Replicator[]

  constructor (config: Config) {
    const starting = async (): Promise<void> => {
      await start(this.replicators)
    }
    const stopping = async (): Promise<void> => {
      await stop(this.replicators)
    }

    super({ starting, stopping })

    this.config = config
    this.replicators = Array.from(register.registered.values()).map(
      (Replicator): Replicator => new Replicator(this.config)
    )
  }
}
