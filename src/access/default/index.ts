// static access controller

import { base32 } from 'multiformats/bases/base32'
import { wildcard } from '../util.js'
import { AccessInstance, AccessStatic } from '../interface.js'
import { Extends } from '../../utils/decorators'
import protocol, { AccessProtocol, Config } from './protocol.js'
import { EntryInstance } from '../../entry/interface.js'
import { ManifestInstance, ManifestData } from '../../manifest/interface.js'
import { Playable } from '../../utils/playable.js'

interface ManifestValue extends ManifestData {
  access: AccessProtocol
}

@Extends<AccessStatic>()
// the Static in StaticAccess means the ACL is immutable and does not change
export class StaticAccess extends Playable implements AccessInstance {
  readonly manifest: ManifestInstance<ManifestValue>
  readonly config: Config
  readonly write: Set<string>

  constructor ({ manifest }: { manifest: ManifestInstance<ManifestValue> }) {
    const starting = async (): Promise<void> => {
      if (!Array.isArray(this.config.write) || this.config.write.length === 0) {
        throw new Error(
          'manifest.access.write does not grant access to any writers'
        )
      }
    }
    const stopping = async (): Promise<void> => {}
    super({ starting, stopping })

    this.manifest = manifest
    this.config = manifest?.access?.config

    if (!Array.isArray(this.config?.write)) {
      throw new Error('expected manifest.access.config.write to be an array')
    }

    this.write = new Set(
      this.config.write.map((w: Uint8Array | string) =>
        typeof w === 'string' ? w : base32.encode(w)
      )
    )
  }

  static get protocol (): string {
    return protocol
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
