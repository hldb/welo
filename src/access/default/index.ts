// static access controller

import { base32 } from 'multiformats/bases/base32'
import { Manifest } from '../../manifest/default/index.js'
import { wildcard } from '../util.js'
import { AccessInstance, AccessStatic, Open } from '../interface.js'
import { Extends } from '../../decorators'
import protocol, { Access, Config } from './protocol.js'
import { EntryInstance } from '../../entry/interface.js'
import { ManifestInstance, ManifestData } from '../../manifest/interface.js'

interface ManifestValue extends ManifestData {
  access: Access
}

@Extends<AccessStatic>()
class StaticAccess implements AccessInstance {
  readonly manifest: Manifest
  readonly config: Config
  readonly write: Set<string>

  constructor ({ manifest }: { manifest: ManifestInstance<ManifestValue> }) {
    this.manifest = manifest
    this.config = manifest.access.config
    this.write = new Set(
      this.config.write.map((w: Uint8Array | string) =>
        typeof w === 'string' ? w : base32.encode(w)
      )
    )
  }

  static get protocol (): string {
    return protocol
  }

  static async open ({
    manifest
  }: Open): Promise<StaticAccess> {
    const config: Config = manifest.access.config
    if (!Array.isArray(config?.write) || config?.write.length === 0) {
      throw new Error(
        'manifest.access.write does not grant access to any writers'
      )
    }

    return new StaticAccess({ manifest })
  }

  async close (): Promise<void> {
    return undefined
  }

  async canAppend (entry: EntryInstance<any>): Promise<boolean> {
    // entry signature has already been validated
    const string = base32.encode(entry.identity.id)
    return this.write.has(string) || this.write.has(wildcard)
  }
}

export { StaticAccess }
