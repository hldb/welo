// static access controller

import { base32 } from 'multiformats/bases/base32'
import { Entry } from '../entry/index.js'
import { Manifest } from '../index.js'
import { wildcard } from './util.js'
import { ComponentConfig } from '../interfaces.js'

const type = 'static'

export interface AccessConfig extends ComponentConfig<typeof type> {
  write: Array<Uint8Array | string>
}

class StaticAccess {
  readonly manifest: Manifest
  readonly write: Set<string>

  constructor ({ manifest }: { manifest: Manifest }) {
    this.manifest = manifest
    this.write = new Set(
      this.manifest.access.write.map((w: Uint8Array | string) =>
        typeof w === 'string' ? w : base32.encode(w)
      )
    )
  }

  static get type (): typeof type {
    return type
  }

  static async open ({
    manifest
  }: {
    manifest: Manifest
  }): Promise<StaticAccess> {
    if (
      !Array.isArray(manifest.access.write) ||
      manifest.access.write.length === 0
    ) {
      throw new Error(
        'manifest.access.write does not grant access to any writers'
      )
    }

    return new StaticAccess({ manifest })
  }

  async close (): Promise<void> {}

  canAppend (entry: Entry): boolean {
    // entry signature has already been validated
    const string = base32.encode(entry.identity.id)
    return this.write.has(string) || this.write.has(wildcard)
  }
}

export { StaticAccess }
