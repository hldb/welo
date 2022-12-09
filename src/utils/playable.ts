import type { Startable } from '@libp2p/interfaces/startable'

export class Playable implements Startable {
  private _isStarted: boolean

  isStarted (): boolean {
    return this._isStarted
  }

  private _starting: Promise<void> | null
  private _stopping: Promise<void> | null

  constructor (private readonly lifecycle: { starting: () => Promise<void>, stopping: () => Promise<void> }) {
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

    this._starting = this.lifecycle.starting()

    return await this._starting
      .then(() => {
        this._isStarted = true
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

    this._stopping = this.lifecycle.stopping()

    return await this._stopping
      .then(() => {
        this._isStarted = false
      })
      .finally(() => {
        this._stopping = null
      })
  }
}
