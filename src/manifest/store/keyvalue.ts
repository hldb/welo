import EventEmitter from 'events'
import { Replica } from 'src/database/replica'
import { Entry } from '../entry'

const type = 'keyvalue'

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

async function reducer(traverse: Entry[], state = initialState()) {
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

  constructor() {
    this.state = initialState()
    this.events = new EventEmitter()
  }

  static async open() {
    return new Keyvalue()
  }

  static get type() {
    return type
  }

  async close() {
    this.state = initialState()
  }

  get actions() {
    return actions
  }

  get selectors() {
    return selectors
  }

  get reducer() {
    return reducer
  }

  async update({ replica }: { replica: Replica }) {
    this.state = await reducer(await replica.traverse())
    this.events.emit('update')
  }
}

export { Keyvalue }
