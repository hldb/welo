import where from 'wherearewe'
import makedir from 'make-dir'
import { LevelDatastore } from 'datastore-level'

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

export type StorageReturn = LevelDatastore

export interface StorageFunc {
  (path: string, options?: StorageOptions): Promise<StorageReturn>
}

// makes easier to handle nodejs and browser environment differences
export const LevelStorage: StorageFunc = async function LevelStorage(
  path,
  options
): Promise<LevelDatastore> {
  options = options || {}
  // todo: handle less common environments like electron
  if (where.isBrowser) {
    options.prefix = '' // removes the 'level' prefix from the path in indexeddb
  }
  if (where.isNode) {
    await makedir(path)
  }

  return new LevelDatastore(path, options)
}
