import type { Startable } from '@libp2p/interface/startable'

/**
 * Implements {@link https://github.com/libp2p/js-libp2p-interfaces/tree/master/packages/interfaces#startable
 * | Libp2p's Startable interface} for easy reuse with async code.
 *
 * @public
 */
export class Playable implements Startable {
  private _isStarted: boolean

  isStarted (): boolean {
    return this._isStarted
  }

  private _starting: Promise<void> | null
  private _stopping: Promise<void> | null

  constructor (
    private readonly lifecycle: {
      starting: () => Promise<void>
      stopping: () => Promise<void>
    }
  ) {
    this._isStarted = false
    this._starting = null
    this._stopping = null
  }

  async start (): Promise<void> {
    if (this.isStarted()) {
      return
    }

    if (this._starting != null) {
      await this._starting; return
    }

    if (this._stopping != null) {
      await this._stopping
    }

    this._starting = this.lifecycle.starting()

    await this._starting
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
      await this._stopping; return
    }

    if (this._starting != null) {
      await this._starting
    }

    this._stopping = this.lifecycle.stopping()

    await this._stopping
      .then(() => {
        this._isStarted = false
      })
      .finally(() => {
        this._stopping = null
      })
  }
}
