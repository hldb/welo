import { HashMap } from 'ipld-hashmap'
import { loadHashMap } from '../../database/graph.js'
import { EntryData, EntryInstance } from '../../entry/interface.js'
import { Blocks } from '../../mods/blocks.js'

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
  get: (state: StateMap) => async (key: string) => {
    const value = await state.get(key)
    return value === deleted ? undefined : value
  }
}

export type StateMap = HashMap<any>

export const init = async (blocks: Blocks): Promise<StateMap> => await loadHashMap(blocks)

interface EntryValue extends EntryData {
  payload: Put | Del
}

// hack for now
const deleted = '__deleted__'

export async function reducer (
  state: StateMap,
  entry: EntryInstance<EntryValue>
): Promise<StateMap> {
  try {
    const { op, key, value } = entry.payload

    if (await state.has(key)) {
      return state
    }

    switch (op) {
      case ops.PUT:
        await state.set(key, value)
        break
      case ops.DEL:
        await state.set(key, deleted) // set to undefined so we know this key is handled
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
