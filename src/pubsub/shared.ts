import { base32 } from 'multiformats/bases/base32'
import type { Libp2p } from 'libp2p'

import { Playable } from '~utils/playable'
import type { Address } from '~manifest/address'

import { Monitor } from './monitor'

const topicPrefix = '/opal/replicator/live/1.0.0/'
const channelTopic = (address: Address): string =>
  topicPrefix + address.toString(base32)

export class SharedChannel extends Playable {
  readonly libp2p: Libp2p
  readonly address: Address
  readonly monitor: Monitor

  constructor (libp2p: Libp2p, address: Address) {
    const starting = async (): Promise<void> => {
      this.libp2p.pubsub.subscribe(this.topic)
      this.libp2p.pubsub.addEventListener('message', this._emptyHandler)
      this.monitor.start()
    }
    const stopping = async (): Promise<void> => {
      this.libp2p.pubsub.unsubscribe(this.topic)
      this.libp2p.pubsub.removeEventListener('message', this._emptyHandler)
      this.monitor.stop()
    }
    super({ starting, stopping })

    this.libp2p = libp2p
    this.address = address
    this.monitor = new Monitor(libp2p, this.topic)
  }

  get topic (): string {
    return channelTopic(this.address)
  }

  private _emptyHandler (): void {}
}
