import EventEmitter from 'events'

const peerJoin = 'peer-join'
const peerLeave = 'peer-leave'
const update = 'update'

export class Monitor {
  constructor(pubsub, topic) {
    this.pubsub = pubsub
    this.topic = topic
    this.peers = new Set()
    this.events = new EventEmitter()
    this._controller = null
  }

  async start(interval = 1000) {
    this._controller = new AbortController()

    // re-call _poll
    const recall = async () => {
      if (this._controller.signal.aborted) {
        return
      }

      await this._poll()

      setTimeout(interval, recall)
    }
    recall()

    this.events.on(peerJoin, () => this.events.emit(update))
    this.events.on(peerLeave, () => this.events.emit(update))
  }

  async stop() {
    this.events.remoteListeners(peerJoin)
    this.events.remoteListeners(peerLeave)
    this._controller.abort()
    this.peers = new Set()
  }

  async _poll() {
    const _peers = this.peers
    this.peers = new Set(await this.pubsub.peers(this.topic))

    for (const peer of this.peers) {
      !_peers.has(peer) && this.events.emit(peerJoin, peer)
    }

    for (const peer of _peers) {
      !this.peers.has(peer) && this.events.emit(peerLeave, peer)
    }
  }
}
