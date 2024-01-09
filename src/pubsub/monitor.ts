import { EventEmitter, CustomEvent } from '@libp2p/interfaces/events'
import { getPeers } from './util.js'
import type { GossipLibp2p } from '@/interface'
import type { PeerId } from '@libp2p/interface/peer-id'
import type { SubscriptionChangeData } from '@libp2p/interface/pubsub'
import type { Startable } from '@libp2p/interfaces/startable'
import { parsedPeerId, peerIdString } from '@/utils/index.js'

export interface PeerStatusChangeData {
  peerId: PeerId
}

export interface MonitorEvents {
  'peer-join': CustomEvent<PeerStatusChangeData>
  'peer-leave': CustomEvent<PeerStatusChangeData>
  update: CustomEvent<undefined>
}

export class Monitor extends EventEmitter<MonitorEvents> implements Startable {
  private _isStarted: boolean
  peers: Set<string>
  readonly #refreshPeers: typeof refreshPeers

  isStarted (): boolean {
    return this._isStarted
  }

  constructor (readonly libp2p: GossipLibp2p, readonly topic: string) {
    super()
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
      this.libp2p.services.pubsub.addEventListener(
        'subscription-change',
        this.#refreshPeers
      )
      this.libp2p.services.pubsub.subscribe(this.topic)
      this.peers = new Set(
        getPeers(this.libp2p.services.pubsub, this.topic).map(peerIdString)
      )
      this._isStarted = true
    }
  }

  stop (): void {
    if (this.isStarted()) {
      this.libp2p.services.pubsub.removeEventListener(
        'subscription-change',
        this.#refreshPeers
      )
      this.libp2p.services.pubsub.unsubscribe(this.topic)
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
    getPeers(this.libp2p.services.pubsub, this.topic).map(peerIdString)
  )

  const joins = new Set<string>()
  for (const peer of this.peers) {
    !_peers.has(peer) && joins.add(peer)
  }

  const leaves = new Set<string>()
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
