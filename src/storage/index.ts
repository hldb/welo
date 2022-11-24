import where from 'wherearewe'
import makedir from 'make-dir'
import { LevelDatastore } from 'datastore-level'
import type { Datastore } from 'interface-datastore'

export interface StorageOptions {
  db?: any
  createIfMissing?: boolean | undefined
  errorIfExists?: boolean | undefined
  prefix?: string | undefined
  version?: number | undefined
  cacheSize?: number | undefined
  writeBufferSize?: number | undefined
  blockSize?: number | undefined
  maxOpenFiles?: number | undefined
  blockRestartInterval?: number | undefined
  maxFileSize?: number | undefined
}

export type getStorage = (
  path: string,
  options?: StorageOptions
) => Promise<Datastore>

// makes easier to handle nodejs and browser environment differences
export const getLevelStorage: getStorage = async function (
  path,
  options
): Promise<LevelDatastore> {
  options = options != null ? options : {}
  // todo: handle less common environments like electron
  if (where.isBrowser) {
    options.prefix = '' // removes the 'level' prefix from the path in indexeddb
  }
  if (where.isNode) {
    if (typeof path === 'string') await makedir(path)
  }

  return new LevelDatastore(path, options)
}
