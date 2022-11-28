import EventEmitter from 'events'
import { base32 } from 'multiformats/bases/base32'
import type { Libp2p } from 'libp2p'
import type { PeerId } from '@libp2p/interface-peer-id'
import type { Message, PublishResult } from '@libp2p/interface-pubsub'
import type { CID } from 'multiformats/cid'

import * as Advert from '~replicator/live/message.js'
import { Playable } from '~utils/playable.js'
import type { Address } from '~manifest/address.js'

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
  readonly libp2p: Libp2p
  readonly address: Address
  readonly localPeerId: PeerId
  readonly remotePeerId: PeerId
  readonly monitor: Monitor
  readonly events: EventEmitter

  constructor (
    libp2p: Libp2p,
    address: Address,
    localPeerId: PeerId,
    remotePeerId: PeerId
  ) {
    const starting = async (): Promise<void> => {
      this.libp2p.pubsub.subscribe(this.topic)
      this.libp2p.pubsub.addEventListener('message', this._onMessage)
      this.monitor.start()
    }
    const stopping = async (): Promise<void> => {
      this.libp2p.pubsub.unsubscribe(this.topic)
      this.libp2p.pubsub.removeEventListener('message', this._onMessage)
      this.monitor.stop()
    }
    super({ starting, stopping })

    this.libp2p = libp2p
    this.address = address
    this.localPeerId = localPeerId
    this.remotePeerId = remotePeerId

    this.monitor = new Monitor(this.libp2p, this.topic)
    this.events = new EventEmitter()
  }

  get topic (): string {
    return channelTopic(this.localPeerId, this.remotePeerId)
  }

  isOpen (): boolean {
    return this.monitor.peers.has(this.remotePeerId.toString())
  }

  private _onMessage (evt: CustomEvent<Message>): void {
    const message = evt.detail
    if (message.type === 'unsigned') {
      return
    }

    if (b32PeerId(message.from) !== b32PeerId(this.remotePeerId)) {
      return
    }

    void Advert.read(message.data).then((advert) => {
      if (advert.value.database.equals(this.address.cid)) {
        this.events.emit('message', message)
      }
    })
  }

  async publish (heads: CID[]): Promise<PublishResult> {
    if (!this.isOpen()) {
      throw new Error('direct pubsub not open')
    }

    const advert = await Advert.write(this.address.cid, heads)

    return await this.libp2p.pubsub.publish(this.topic, advert.bytes)
  }
}
