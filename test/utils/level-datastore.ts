import { LevelDatastore } from 'datastore-level'
import makedir from 'make-dir'
import * as where from 'wherearewe'
import type { DatabaseOptions, OpenOptions } from 'level'

export default async (
  path: string,
  options: DatabaseOptions<string, Uint8Array> & OpenOptions = {}
): Promise<LevelDatastore> => {
  if (where.isBrowser) {
    options.prefix = '' // removes the 'level' prefix from the path in indexeddb
  }

  if (where.isNode && typeof path === 'string') {
    await makedir(path)
  }

  return new LevelDatastore(path, options)
}
