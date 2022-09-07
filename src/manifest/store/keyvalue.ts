import EventEmitter from 'events'
import { Replica } from 'src/database/replica'
import { Entry } from '../entry'
import { ComponentConfig } from '../interfaces'

const type = 'keyvalue'

export interface StoreConfig extends ComponentConfig<typeof type> {
  snap?: any
}

const ops = Object.fromEntries(['PUT', 'DEL'].map((op) => [op, op]))

const actions = {
  put: (key: string, value: any) => ({ op: ops.PUT, key, value }),
  del: (key: string) => ({ op: ops.DEL, key })
}

const selectors = {
  get: (state: StateMap) => (key: string) => state.get(key)
}

type StateMap = Map<string, any>

const initialState = (): StateMap => new Map()

async function reducer (
  traverse: Entry[],
  state = initialState()
): Promise<StateMap> {
  for (const {
    payload: { op, key, value }
  } of traverse) {
    if (state.has(key)) {
      continue
    }

    switch (op) {
      case ops.PUT:
        state.set(key, value)
        break
      case ops.DEL:
        state.set(key, undefined) // set to undefined so we know this key is handled
        break
      default:
        break
    }
  }

  return state
}

class Keyvalue {
  state: Map<string, any>
  events: EventEmitter

  constructor () {
    this.state = initialState()
    this.events = new EventEmitter()
  }

  static async open (): Promise<Keyvalue> {
    return new Keyvalue()
  }

  static get type (): typeof type {
    return type
  }

  async close (): Promise<void> {
    this.state = initialState()
  }

  get actions (): typeof actions {
    return actions
  }

  get selectors (): typeof selectors {
    return selectors
  }

  get reducer (): typeof reducer {
    return reducer
  }

  async update ({ replica }: { replica: Replica }): Promise<void> {
    this.state = await reducer(await replica.traverse())
    this.events.emit('update')
  }
}

export { Keyvalue }
