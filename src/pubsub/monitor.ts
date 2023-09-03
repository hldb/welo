import { EventEmitter, CustomEvent } from '@libp2p/interface/events'
import type { PubSub, SubscriptionChangeData } from '@libp2p/interface/pubsub'
import type { Startable } from '@libp2p/interface/startable'
import type { PeerId } from '@libp2p/interface/peer-id'

import { parsedPeerId, peerIdString } from '@/utils/index.js'

import { getPeers } from './util.js'

export interface PeerStatusChangeData {
  peerId: PeerId
}

export interface MonitorEvents {
  'peer-join': CustomEvent<PeerStatusChangeData>
  'peer-leave': CustomEvent<PeerStatusChangeData>
  update: CustomEvent<undefined>
}

export class Monitor extends EventEmitter<MonitorEvents> implements Startable {
  readonly pubsub: PubSub
  readonly topic: string
  readonly #refreshPeers: typeof refreshPeers
  private _isStarted: boolean

  peers: Set<string>

  isStarted (): boolean {
    return this._isStarted
  }

  constructor (pubsub: PubSub, topic: string) {
    super()
    this.pubsub = pubsub
    this.topic = topic
    this._isStarted = false
    this.peers = new Set()
    this.#refreshPeers = refreshPeers.bind(this)

    this.addEventListener('peer-join', () =>
      this.dispatchEvent(new CustomEvent<undefined>('update'))
    )
    this.addEventListener('peer-leave', () =>
      this.dispatchEvent(new CustomEvent<undefined>('update'))
    )
  }

  start (): void {
    if (!this.isStarted()) {
      this.pubsub.addEventListener(
        'subscription-change',
        this.#refreshPeers
      )
      this.pubsub.subscribe(this.topic)
      this.peers = new Set(
        getPeers(this.pubsub, this.topic).map(peerIdString)
      )
      this._isStarted = true
    }
  }

  stop (): void {
    if (this.isStarted()) {
      this.pubsub.removeEventListener(
        'subscription-change',
        this.#refreshPeers
      )
      this.pubsub.unsubscribe(this.topic)
      this.peers = new Set()
      this._isStarted = false
    }
  }
}

function refreshPeers (
  this: Monitor,
  evt: CustomEvent<SubscriptionChangeData>
): void {
  let affected = false
  for (const { topic } of evt.detail.subscriptions) {
    if (topic === this.topic) {
      affected = true
    }
  }

  if (!affected) {
    return
  }

  const _peers = this.peers
  this.peers = new Set(
    getPeers(this.pubsub, this.topic).map(peerIdString)
  )

  const joins: Set<string> = new Set()
  for (const peer of this.peers) {
    !_peers.has(peer) && joins.add(peer)
  }

  const leaves: Set<string> = new Set()
  for (const peer of _peers) {
    !this.peers.has(peer) && leaves.add(peer)
  }

  for (const join of joins) {
    this.dispatchEvent(
      new CustomEvent<PeerStatusChangeData>('peer-join', {
        detail: { peerId: parsedPeerId(join) }
      })
    )
  }

  for (const leave of leaves) {
    this.dispatchEvent(
      new CustomEvent<PeerStatusChangeData>('peer-leave', {
        detail: { peerId: parsedPeerId(leave) }
      })
    )
  }
}
