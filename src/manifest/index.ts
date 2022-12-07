import type { BlockView } from 'multiformats/interface'

import { Blocks } from '~blocks/index.js'

import { Address } from './address.js'
import type {
  AsManifest,
  Create,
  Fetch,
  ManifestData,
  Protocol
} from './interface.js'

export { Address }

export class Manifest {
  readonly name: string
  readonly store: Protocol
  readonly access: Protocol
  readonly entry: Protocol
  readonly identity: Protocol
  readonly meta?: any
  readonly tag?: Uint8Array

  get address (): Address {
    return new Address(this.block.cid)
  }

  getTag (): Uint8Array {
    return this.tag != null ? this.tag : this.block.cid.bytes
  }

  constructor (readonly block: BlockView<ManifestData>) {
    const manifest = block.value
    this.name = manifest.name
    this.store = manifest.store
    this.access = manifest.access
    this.entry = manifest.entry
    this.identity = manifest.identity
    if (manifest.meta != null) this.meta = manifest.meta
    if (manifest.tag != null) this.tag = manifest.tag
  }

  static async create (manifest: Create): Promise<Manifest> {
    const block = await Blocks.encode({ value: manifest })
    return new Manifest(block)
  }

  static async fetch ({ blocks, address }: Fetch): Promise<Manifest> {
    const block: BlockView<ManifestData> = await blocks.get<ManifestData>(
      address.cid
    )
    const manifest = this.asManifest({ block })

    if (manifest === null) {
      throw new Error('Manifest.fetch: cid did not resolve to valid manifest')
    }

    return manifest
  }

  static asManifest (manifest: AsManifest): Manifest | null {
    if (manifest instanceof Manifest) {
      return manifest
    }

    try {
      const { block } = manifest
      return new Manifest(block)
    } catch (e) {
      return null
    }
  }
}
