import EventEmitter from 'events'
import type { Libp2p } from 'libp2p'
import type { Startable } from '@libp2p/interfaces/startable'

import { peerIdString } from '~utils/index.js'

import { getPeers } from './util.js'

const peerJoin = 'peer-join'
const peerLeave = 'peer-leave'
const update = 'update'

export class Monitor extends EventEmitter implements Startable {
  private _isStarted: boolean
  peers: Set<string>
  readonly #refreshPeers: typeof refreshPeers

  isStarted (): boolean {
    return this._isStarted
  }

  constructor (
    readonly libp2p: Libp2p,
    readonly topic: string
  ) {
    super()
    this._isStarted = false
    this.peers = new Set()
    this.#refreshPeers = refreshPeers.bind(this)

    this.on(peerJoin, () => this.emit(update))
    this.on(peerLeave, () => this.emit(update))
  }

  start (): void {
    if (!this.isStarted()) {
      this.libp2p.pubsub.addEventListener(
        'subscription-change',
        this.#refreshPeers
      )
      this.libp2p.pubsub.subscribe(this.topic)
      this.peers = new Set(getPeers(this.libp2p.pubsub, this.topic).map(peerIdString))
      this._isStarted = true
    }
  }

  stop (): void {
    if (this.isStarted()) {
      this.libp2p.pubsub.removeEventListener(
        'subscription-change',
        this.#refreshPeers
      )
      this.libp2p.pubsub.unsubscribe(this.topic)
      this.peers = new Set()
      this._isStarted = false
    }
  }
}

function refreshPeers (this: Monitor): void {
  const _peers = this.peers
  this.peers = new Set(getPeers(this.libp2p.pubsub, this.topic).map(peerIdString))

  const joins = new Set()
  for (const peer of this.peers) {
    !_peers.has(peer) && joins.add(peer)
  }

  const leaves = new Set()
  for (const peer of _peers) {
    !this.peers.has(peer) && leaves.add(peer)
  }

  for (const join of joins) {
    this.emit(peerJoin, join)
  }

  for (const leave of leaves) {
    this.emit(peerLeave, leave)
  }
}
