import EventEmitter from 'events'
import { IPFS } from 'ipfs-core-types'
import { Startable } from '@libp2p/interfaces/startable'

const peerJoin = 'peer-join'
const peerLeave = 'peer-leave'
const update = 'update'

export class Monitor implements Startable {
  readonly ipfs: IPFS
  readonly topic: string
  readonly interval: number

  peers: Set<string>

  readonly events: EventEmitter

  private _isStarted: boolean

  isStarted (): boolean {
    return this._isStarted
  }

  start (): void {
    if (this.isStarted()) {
      return
    }

    this._isStarted = true

    const recall = (): void => {
      void this._poll().then(() => {
        if (this.isStarted()) {
          setTimeout(recall, this.interval)
        }
      })
    }

    recall()
  }

  stop (): void {
    if (!this.isStarted()) {
      return
    }

    this._isStarted = false
  }

  constructor (ipfs: IPFS, topic: string, interval: number = 1000) {
    this.ipfs = ipfs
    this.topic = topic
    this.interval = 1000

    this.peers = new Set()

    this.events = new EventEmitter()
    this.events.on(peerJoin, () => this.events.emit(update))
    this.events.on(peerLeave, () => this.events.emit(update))

    this._isStarted = false
  }

  async _poll (): Promise<void> {
    const _peers = this.peers
    const peers = new Set((await this.ipfs.pubsub.peers(this.topic)).map(String))

    if (!this.isStarted()) {
      return
    }

    this.peers = peers

    for (const peer of this.peers) {
      !_peers.has(peer) && this.events.emit(peerJoin, peer)
    }

    for (const peer of _peers) {
      !this.peers.has(peer) && this.events.emit(peerLeave, peer)
    }
  }
}
