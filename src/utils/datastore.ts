import * as where from 'wherearewe'
import makedir from 'make-dir'
import type { LevelDatastore } from 'datastore-level'
import type { DatabaseOptions, Level, OpenOptions } from 'level'

type LevelDatastorePath = string | Level<string, Uint8Array>

type LevelDatastoreOptions = DatabaseOptions<string, Uint8Array> & OpenOptions

type DatastorePath = LevelDatastorePath

type DatastoreOptions = LevelDatastoreOptions

export type DatastoreClass = new (
  path: DatastorePath,
  options: DatastoreOptions
) => LevelDatastore

export type GetDatastore = (
  Datastore: DatastoreClass,
  path: DatastorePath,
  options?: DatastoreOptions
) => Promise<LevelDatastore>

// makes easier to handle nodejs and browser environment differences
export const getDatastore: GetDatastore = async (
  Datastore: DatastoreClass,
  path: DatastorePath,
  options: DatastoreOptions = {}
): Promise<LevelDatastore> => {
  // todo: handle less common environments like electron
  if (where.isBrowser) {
    options.prefix = '' // removes the 'level' prefix from the path in indexeddb
  }
  if (where.isNode) {
    if (typeof path === 'string') await makedir(path)
  }

  return new Datastore(path, options)
}
