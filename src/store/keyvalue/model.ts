import { Key } from 'interface-datastore'
import { encode, decode } from '@ipld/dag-cbor'
import { CodeError } from '@libp2p/interfaces/errors'
import type { ShardLink } from '@alanshaw/pail/shard'
import type { Blockstore } from 'interface-blockstore'

import { IpldDatastore, Paily } from '@/utils/paily.js'
import type { EntryData, EntryInstance } from '@/entry/interface.js'

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
    let bytes: Uint8Array
    try {
      bytes = await state.get(new Key(key))
    } catch (e) {
      if (e instanceof CodeError && e.code === 'ERR_NOT_FOUND') {
        return undefined
      }

      throw e
    }
    return decode(bytes) ?? undefined
  }
}

export type StateMap = IpldDatastore<ShardLink>

export const init = async (blockstore: Blockstore): Promise<StateMap> =>
  await Paily.create(blockstore)

export const load = (blockstore: Blockstore, cid: ShardLink): StateMap =>
  Paily.open(blockstore, cid)

interface EntryValue extends EntryData {
  payload: Put | Del
}

export async function reducer (
  state: StateMap,
  entry: EntryInstance<EntryValue>
): Promise<StateMap> {
  try {
    const { op, key, value } = entry.payload

    if (await state.has(new Key(key))) {
      return state
    }

    switch (op) {
      case ops.PUT:
        await state.put(new Key(key), encode(value))
        break
      case ops.DEL:
        await state.put(new Key(key), encode(null)) // set to undefined so we know this key is handled
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
