import * as where from 'wherearewe'
import makedir from 'make-dir'
import type { Datastore, Options } from 'interface-datastore'
import type { DatabaseOptions, OpenOptions } from 'level'
import type { AbstractLevel } from 'abstract-level'

type LevelDatastorePath = string | AbstractLevel<any, string, Uint8Array>

type LevelDatastoreOptions = DatabaseOptions<string, Uint8Array> & OpenOptions

type DatastorePath = LevelDatastorePath

type DatastoreOptions = Options & LevelDatastoreOptions

export type DatastoreClass = new (
  path: DatastorePath,
  options: DatastoreOptions
) => Datastore

export type GetDatastore = (
  Datastore: DatastoreClass,
  path: DatastorePath,
  options?: DatastoreOptions
) => Promise<Datastore>

// makes easier to handle nodejs and browser environment differences
export const getDatastore: GetDatastore = async (
  Datastore: DatastoreClass,
  path: DatastorePath,
  options: DatastoreOptions = {}
): Promise<Datastore> => {
  // todo: handle less common environments like electron
  if (where.isBrowser) {
    options.prefix = '' // removes the 'level' prefix from the path in indexeddb
  }
  if (where.isNode) {
    if (typeof path === 'string') await makedir(path)
  }

  return new Datastore(path, options)
}
