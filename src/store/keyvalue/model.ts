import type { HashMap } from 'ipld-hashmap'

import { loadHashMap } from '~/replica/graph.js'
import type { EntryData, EntryInstance } from '~/entry/interface.js'
import type { Blocks } from '~/blocks/index.js'

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
  get: (state: StateMap) => async (key: string) =>
    (await state.get(key)) ?? undefined
}

export type StateMap = HashMap<any>

export const init = async (blocks: Blocks): Promise<StateMap> =>
  await loadHashMap(blocks)

interface EntryValue extends EntryData {
  payload: Put | Del
}

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
        await state.set(key, null) // set to undefined so we know this key is handled
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
