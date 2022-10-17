import { Block } from 'multiformats/block'

import { Blocks } from '../../mods/blocks.js'
import { Address } from '../address.js'
import {
  AsManifest,
  Create,
  Fetch,
  ManifestData,
  ManifestInstance,
  ManifestStatic,
  Protocol
} from '../interface.js'
import { Extends } from '../../utils/decorators.js'

export { Address }

@Extends<ManifestStatic<ManifestData>>()
export class Manifest implements ManifestInstance<ManifestData> {
  readonly name: string
  readonly store: Protocol
  readonly access: Protocol
  readonly entry: Protocol
  readonly identity: Protocol
  readonly meta?: any
  readonly tag?: Uint8Array
  readonly getTag: Uint8Array

  private readonly _address: Address

  get address (): Address {
    return this._address
  }

  constructor (readonly block: Block<ManifestData>) {
    const manifest = block.value
    this.name = manifest.name
    this.store = manifest.store
    this.access = manifest.access
    this.entry = manifest.entry
    this.identity = manifest.identity
    if (manifest.meta != null) this.meta = manifest.meta
    if (manifest.tag != null) this.tag = manifest.tag

    this.getTag = manifest.tag != null ? manifest.tag : block.cid.bytes
    this._address = new Address(block.cid)
  }

  static async create (manifest: Create): Promise<Manifest> {
    const block = await Blocks.encode({ value: manifest })
    return new Manifest(block)
  }

  static async fetch ({ blocks, address }: Fetch): Promise<Manifest> {
    const block: Block<ManifestData> = await blocks.get(address.cid)
    const manifest = this.asManifest({ block })

    if (manifest === null) {
      throw new Error('Manifest.fetch: cid did not resolve to valid manifest')
    }

    return manifest
  }

  static asManifest (manifest: AsManifest<ManifestData>): Manifest | null {
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
