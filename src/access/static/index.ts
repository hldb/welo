import { base32 } from 'multiformats/bases/base32'

import { Playable } from '@/utils/playable.js'
import type { EntryInstance } from '@/entry/interface.js'
import type { Manifest } from '@/manifest/index.js'

import protocol, { Config } from './protocol.js'
import { wildcard, Open, AccessInstance, AccessModule } from '../interface.js'

// the Static in StaticAccess means the ACL is immutable and does not change
export class StaticAccess extends Playable implements AccessInstance {
  readonly manifest: Manifest
  readonly config: Config
  readonly write: Set<string>

  constructor ({ manifest }: Open) {
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
    this.config = manifest?.access?.config as Config

    if (!Array.isArray(this.config?.write)) {
      throw new Error('expected manifest.access.config.write to be an array')
    }

    this.write = new Set(
      this.config.write.map((w: Uint8Array | string) =>
        typeof w === 'string' ? w : base32.encode(w)
      )
    )
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

export const createStaticAccess: () => AccessModule<StaticAccess, typeof protocol> = () => ({
  protocol,
  create: (open: Open) => new StaticAccess(open)
})
