import EventEmitter from 'events'
import { PubsubHeadsExchange } from './pubsub-heads-exchange.js'

export class Replicator {
  constructor(config, modules) {
    this.config = config
    this.modules = modules
    this.events = new EventEmitter()
  }

  async close() {
    await this.stop()
  }

  async start() {
    await Promise.all(this.modules.map((module) => module.start()))
  }

  async stop() {
    await Promise.all(this.modules.map((module) => module.stop()))
  }

  static modules() {
    return [PubsubHeadsExchange]
  }
}
