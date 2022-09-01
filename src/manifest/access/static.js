
// static access controller

import { base32 } from 'multiformats/bases/base32'
import { wildcard } from './util.js'

const type = 'static'

class StaticAccess {
  constructor ({ manifest }) {
    this.manifest = manifest
    this.write = new Set(
      this.manifest.access.write.map(w =>
        typeof w === 'string' ? w : base32.encode(w)
      )
    )
  }

  static get type () { return type }

  static async open ({ manifest }) {
    if (!Array.isArray(manifest.access.write) || !manifest.access.write.length) {
      throw new Error('manifest.access.write does not grant access to any writers')
    }

    return new StaticAccess({ manifest })
  }

  async close () {}

  canAppend (entry) {
    // entry signature has already been validated
    const string = base32.encode(entry.identity.id)
    return this.write.has(string) || this.write.has(wildcard)
  }
}

export { StaticAccess }
