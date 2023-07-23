import * as where from 'wherearewe'
import makedir from 'make-dir'
import { MemoryDatastore } from 'datastore-core'
import { MemoryBlockstore } from 'blockstore-core'
import { LevelDatastore } from 'datastore-level'
import { LevelBlockstore } from 'blockstore-level'
import type { DatabaseOptions, OpenOptions } from 'level'

export const getMemoryDatastore = (): MemoryDatastore => new MemoryDatastore()

export const getMemoryBlockstore = (): MemoryBlockstore => new MemoryBlockstore()

interface LevelStoreConstructor <S> {
  new (
    path: string,
    options: DatabaseOptions<string, Uint8Array> & OpenOptions
  ): S
}

const getLevelStore = <S>(LevelStore: LevelStoreConstructor<S>) => async (
  path: string,
  options: DatabaseOptions<string, Uint8Array> & OpenOptions = {}
): Promise<S> => {
  if (where.isBrowser) {
    options.prefix = '' // removes the 'level' prefix from the path in indexeddb
  }

  if (where.isNode && typeof path === 'string') {
    await makedir(path)
  }

  return new LevelStore(path, options)
}

export const getLevelDatastore = getLevelStore(LevelDatastore)
export const getLevelBlockstore = getLevelStore(LevelBlockstore)

interface VolatileStorage {
  datastore: MemoryDatastore
  blockstore: MemoryBlockstore
}

export const getVolatileStorage = (): VolatileStorage => ({
  datastore: getMemoryDatastore(),
  blockstore: getMemoryBlockstore()
})

interface NonVolatileStorage {
  datastore: LevelDatastore
  blockstore: LevelBlockstore
}

export const getNonVolatileStorage = async (path: string): Promise<NonVolatileStorage> => ({
  datastore: await getLevelDatastore(path + '/data'),
  blockstore: await getLevelBlockstore(path + '/blocks')
})
