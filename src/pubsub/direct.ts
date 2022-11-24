import EventEmitter from 'events'
import type { IPFS } from 'ipfs-core-types'
import type { PeerId } from '@libp2p/interface-peer-id'
import type { Message } from '@libp2p/interface-pubsub'
import { base32 } from 'multiformats/bases/base32'
import type { CID } from 'multiformats/cid'

import type { Address } from '~manifest/address.js'
import * as Advert from '~replicator/live/message.js'
import { Playable } from '~utils/playable.js'

import { Monitor } from './monitor.js'

const prefix = '/dps/1.0.0/'

function sortAlphabetical (a: string, b: string): 1 | 0 | -1 {
  const nameA = a.toUpperCase() // ignore upper and lowercase
  const nameB = b.toUpperCase() // ignore upper and lowercase
  if (nameA < nameB) {
    return -1
  }

  if (nameA > nameB) {
    return 1
  }

  // names must be equal
  return 0
}

const b32PeerId = (peerId: PeerId): string => peerId.toCID().toString(base32)

const channelTopic = (localPeerId: PeerId, remotePeerId: PeerId): string => {
  if (localPeerId === remotePeerId) {
    throw new Error('no direct channel with self')
  }

  const peerids = [b32PeerId(localPeerId), b32PeerId(remotePeerId)].sort(
    sortAlphabetical
  )

  return prefix + peerids.join('/')
}

// The Direct Channel spec for the Live Replicator specifies that the channel is not unique per database
// This implementation makes it easier to handle messages per store while the pubsub channel is still shared

export class DirectChannel extends Playable {
  readonly ipfs: IPFS
  readonly address: Address
  readonly localPeerId: PeerId
  readonly remotePeerId: PeerId
  readonly monitor: Monitor
  readonly events: EventEmitter

  constructor (
    ipfs: IPFS,
    address: Address,
    localPeerId: PeerId,
    remotePeerId: PeerId
  ) {
    const starting = async (): Promise<void> => {
      await this.ipfs.pubsub.subscribe(this.topic, this._onMessage)
      this.monitor.start()
    }
    const stopping = async (): Promise<void> => {
      await this.ipfs.pubsub.unsubscribe(this.topic, this._onMessage)
      this.monitor.stop()
    }
    super({ starting, stopping })

    this.ipfs = ipfs
    this.address = address
    this.localPeerId = localPeerId
    this.remotePeerId = remotePeerId

    this.monitor = new Monitor(this.ipfs, this.topic)
    this.events = new EventEmitter()
  }

  get topic (): string {
    return channelTopic(this.localPeerId, this.remotePeerId)
  }

  isOpen (): boolean {
    return this.monitor.peers.has(this.remotePeerId.toString())
  }

  private _onMessage (message: Message): void {
    if (message.type === 'unsigned') {
      return
    }

    if (b32PeerId(message.from) !== b32PeerId(this.remotePeerId)) {
      return
    }

    void Advert.read(message.data).then((advert) => {
      if (advert.value.database.equals(this.address.cid) === true) {
        this.events.emit('message', message)
      }
    })
  }

  async publish (heads: CID[]): Promise<void> {
    if (!this.isOpen()) {
      throw new Error('direct pubsub not open')
    }

    const advert = await Advert.write(this.address.cid, heads)

    return await this.ipfs.pubsub.publish(this.topic, advert.bytes)
  }
}
