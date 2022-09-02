
import where from 'wherearewe'
import makedir from 'make-dir'
import { LevelDatastore } from 'datastore-level'

import { CID } from 'multiformats/cid'
import { base32 } from 'multiformats/bases/base32'

// makes easier to handle nodejs and browser environment differences
async function Storage (path, options = {}) {
  // todo: handle less common environments like electron
  if (where.isBrowser) {
    options.prefix = '' // removes the 'level' prefix from the path in indexeddb
  }
  if (where.isNode) {
    await makedir(path)
  }

  return new LevelDatastore(path, options)
}

export { Storage }

export const cidstring = (cid) => cid.toString(base32)
export const parsedcid = (string) => CID.parse(string, base32)
