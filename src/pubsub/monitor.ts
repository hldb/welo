import EventEmitter from 'events'
import { Libp2p } from 'libp2p'

import { peerIdString } from '~utils/index'

const peersJoin = 'peers-join'
const peersLeave = 'peers-leave'
const update = 'update'

export class Monitor extends EventEmitter {
  private _isConnected: boolean
  peers: Set<string>

  isConnected (): boolean {
    return this._isConnected
  }

  constructor (
    readonly libp2p: Libp2p,
    readonly topic: string
  ) {
    super()

    this._isConnected = false
    this.peers = new Set()

    this.on(peersJoin, () => this.emit(update))
    this.on(peersLeave, () => this.emit(update))
  }

  connect (): void {
    if (!this.isConnected()) {
      this.libp2p.pubsub.addEventListener('subscription-change', this._refreshPeers)
      this.peers = new Set(this.libp2p.pubsub.getSubscribers(this.topic).map(peerIdString))
      this._isConnected = true
    }
  }

  disconnect (): void {
    if (this.isConnected()) {
      this.libp2p.pubsub.removeEventListener('subscription-change', this._refreshPeers)
      this.peers = new Set()
      this._isConnected = false
    }
  }

  _refreshPeers (): void {
    const _peers = this.peers
    this.peers = new Set(this.libp2p.pubsub.getSubscribers(this.topic).map(peerIdString))

    const join = new Set()
    for (const peer of this.peers) {
      !_peers.has(peer) && join.add(peer)
    }

    const leave = new Set()
    for (const peer of _peers) {
      !this.peers.has(peer) && leave.add(peer)
    }

    if (join.size > 0) {
      this.emit(peersJoin, join)
    }

    if (leave.size > 0) {
      this.emit(peersLeave, leave)
    }
  }
}
