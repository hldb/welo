import { start, stop } from '@libp2p/interfaces/startable'
import EventEmitter from 'events'

import { Database } from '~database/index.js'
import { Playable } from '~utils/playable.js'
import { Config } from './interface.js'

export class MultiReplicator extends Playable {
  static readonly modules: Array<typeof Playable>

  readonly config: Config
  readonly modules: Playable[]
  readonly events: EventEmitter
  database?: Database

  constructor (config: Config) {
    const starting = async (): Promise<void> => {
      await Promise.all(
        this.modules.map(async (module): Promise<void> => await start(module))
      )
    }

    const stopping = async (): Promise<void> => {
      await Promise.all(
        this.modules.map(async (module): Promise<void> => await stop(module))
      )
    }

    super({ starting, stopping })

    this.config = config
    this.modules = MultiReplicator.modules.map(
      (Replicator: any): Playable => new Replicator(this.config)
    )

    this.events = new EventEmitter()
  }
}
