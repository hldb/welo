import type EventEmitter from 'events'
import { Startable } from '@libp2p/interfaces/dist/src/startable'

export interface Lifecycle {
  starting: () => Promise<void>
  stopping: () => Promise<void>
  events?: EventEmitter
}

export class Playable implements Startable {
  private _isStarted: boolean
  private readonly _events?: EventEmitter

  isStarted (): boolean {
    return this._isStarted
  }

  private _starting: Promise<void> | null
  private _stopping: Promise<void> | null

  constructor (private readonly _lifecycle: Lifecycle) {
    this._isStarted = false
    this._starting = null
    this._stopping = null
  }

  async start (): Promise<void> {
    if (this.isStarted()) {
      return
    }

    if (this._starting != null) {
      return await this._starting
    }

    if (this._stopping != null) {
      await this._stopping
    }

    this._starting = this._lifecycle.starting()

    return await this._starting
      .then(() => {
        this._isStarted = true
        if (this._events !== undefined) {
          this._events.emit('start')
        }
      })
      .finally(() => {
        this._starting = null
      })
  }

  async stop (): Promise<void> {
    if (!this.isStarted()) {
      return
    }

    if (this._stopping != null) {
      return await this._stopping
    }

    if (this._starting != null) {
      await this._starting
    }

    this._stopping = this._lifecycle.stopping()

    return await this._stopping
      .then(() => {
        this._isStarted = false
        if (this._events !== undefined) {
          this._events.emit('stop')
        }
      })
      .finally(() => {
        this._stopping = null
      })
  }
}
