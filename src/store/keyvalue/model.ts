import { EntryData, EntryInstance } from '../../entry/interface.js'

const PUT: 'PUT' = 'PUT'
const DEL: 'DEL' = 'DEL'

interface Ops {
  PUT: typeof PUT
  DEL: typeof DEL
}

const ops: Ops = {
  PUT,
  DEL
}

interface Put {
  op: typeof PUT
  key: string
  value: any
}

interface Del {
  op: typeof DEL
  key: string
}

export const creators = {
  put: (key: string, value: any): Put => ({ op: ops.PUT, key, value }),
  del: (key: string): Del => ({ op: ops.DEL, key })
}

export const selectors = {
  get: (state: StateMap) => (key: string) => state.get(key)
}

export type StateMap = Map<string, any>

export const init = (): StateMap => new Map()

interface EntryValue extends EntryData {
  payload: Put | Del
}

export function reducer (state: StateMap, entry: EntryInstance<EntryValue>): StateMap {
  try {
    const { op, key, value } = entry.payload

    if (state.has(key)) {
      return state
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
  } catch (e) {
    console.error(e)
    console.error(new Error('failed to apply entry operation to state'))
  }

  return state
}
