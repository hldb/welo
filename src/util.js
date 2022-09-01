
import where from 'wherearewe'
import { LevelDatastore } from 'datastore-level'

import { CID } from 'multiformats/cid'
import { base32 } from 'multiformats/bases/base32'

// makes easier to handle nodejs and browser environment differences
class Storage extends LevelDatastore {
  constructor(path, options = {}) {
    // todo: handle less common environments like electron
    if (where.isBrowser) {
      options.prefix = '' // removes the 'level' prefix from the path in indexeddb
    }
    super(path, options)
  }
}

export { Storage }

export const cidstring = (cid) => cid.toString(base32)
export const parsedcid = (string) => CID.parse(string, base32)
