import * as where from 'wherearewe'
import makedir from 'make-dir'
import { MemoryDatastore } from 'datastore-core'
import { MemoryBlockstore } from 'blockstore-core'
import { LevelDatastore } from 'datastore-level'
import { LevelBlockstore } from 'blockstore-level'
import type { Datastore } from 'interface-datastore'
import type { Blockstore } from 'interface-blockstore'
import type { DatabaseOptions, OpenOptions } from 'level'

export const getMemoryDatastore = (): Datastore => new MemoryDatastore()

export const getMemoryBlockstore = (): Blockstore => new MemoryBlockstore()

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

interface Storage {
  datastore: Datastore
  blockstore: Blockstore
}

export const getVolatileStorage = (): Storage => ({
  datastore: getMemoryDatastore(),
  blockstore: getMemoryBlockstore()
})

export const getPersistentStorage = async (path: string): Promise<Storage> => ({
  datastore: await getLevelDatastore(path + '/data'),
  blockstore: await getLevelBlockstore(path + '/blocks')
})
