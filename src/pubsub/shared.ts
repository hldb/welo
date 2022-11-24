import type { IPFS } from 'ipfs-core-types'
import { base32 } from 'multiformats/bases/base32'

import type { Address } from '~manifest/address'
import { Playable } from '~utils/playable'

import { Monitor } from './monitor'

const topicPrefix = '/opal/replicator/live/1.0.0/'
const channelTopic = (address: Address): string =>
  topicPrefix + address.toString(base32)

export class SharedChannel extends Playable {
  readonly ipfs: IPFS
  readonly address: Address
  readonly monitor: Monitor

  constructor (ipfs: IPFS, address: Address) {
    const starting = async (): Promise<void> => {
      await this.ipfs.pubsub.subscribe(this.topic, this._emptyHandler)
      this.monitor.start()
    }
    const stopping = async (): Promise<void> => {
      await this.ipfs.pubsub.unsubscribe(this.topic, this._emptyHandler)
      this.monitor.stop()
    }
    super({ starting, stopping })

    this.ipfs = ipfs
    this.address = address
    this.monitor = new Monitor(ipfs, this.topic)
  }

  get topic (): string {
    return channelTopic(this.address)
  }

  private _emptyHandler (): void {}
}
