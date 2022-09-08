import EventEmitter from 'events'
import { Monitor } from './monitor.js'

const prefix = 'psd/v1'
const version = 'v1'

function sortAlphabetical (a, b) {
  const nameA = a.name.toUpperCase() // ignore upper and lowercase
  const nameB = b.name.toUpperCase() // ignore upper and lowercase
  if (nameA < nameB) {
    return -1
  }

  if (nameA > nameB) {
    return 1
  }

  // names must be equal
  return 0
}

export class Direct {
  constructor (pubsub, localPeerId, remotePeerId) {
    this.pubsub = pubsub
    this.localPeerId = localPeerId
    this.remotePeerId = remotePeerId
    this.topic = Direct.directTopic(localPeerId, remotePeerId)

    this.events = new EventEmitter()
    this.monitor = new Monitor(pubsub, this.topic)

    this._handlerMap = new WeakMap()
    this._handlers = [] // exists just so we can still clean up subscriptions
    this.open = false
  }

  static directTopic (localPeerId, remotePeerId) {
    const [peer1, peer2] = [localPeerId, remotePeerId].sort(sortAlphabetical)
    return ['', prefix, version, peer1, peer2].join('/')
  }

  async start (interval) {
    for (const _handler of this._handlers) {
      await this.pubsub.subscribe(this.topic, _handler)
    }

    await this.monitor.start(interval)

    const refresh = () => {
      this.open = this.monitor.peers.has(this.remotePeerId)
    }
    refresh()

    this.monitor.events.on('update', refresh)
  }

  async stop () {
    for (const _handler of this._handlers) {
      await this.pubsub.unsubscribe(this.topic, _handler)
    }

    await this.monitor.stop()

    this.open = false
  }

  async publish (data) {
    if (!this.open) {
      throw new Error('direct pubsub not open')
    }

    return this.pubsub.publish(this.topic, data)
  }

  async subscribe (handler) {
    if (!this.open) {
      throw new Error('direct pubsub not open')
    }

    const _handler = (msg) => msg.from === this.remotePeerId && handler(msg)
    this._handlerMap.set(handler, _handler)

    return this.pubsub.subscribe(this.topic, _handler)
  }

  async unsubscribe (handler) {
    const _handler = this._handlers.get(handler)
    this._handlerMap.delete(handler)

    return this.pubsub.unsubscribe(this.topic, _handler)
  }
}
