import type { Block } from 'multiformats/block.js'
import { Blocks } from '../../mods/blocks.js'
import { Address } from '../address.js'
import { AsManifest, Create, Fetch, ManifestData, ManifestInterface, ManifestStatic, Protocol } from '../interface.js'
import { staticImplements } from '../../decorators'
import protocol from './protocol.js'

type ManifestValue = ManifestData

@staticImplements<ManifestStatic<ManifestValue>>()
class Manifest implements ManifestInterface<ManifestValue> {
  readonly protocol: string
  readonly name: string
  readonly store: Protocol
  readonly access: Protocol
  readonly entry: Protocol
  readonly identity: Protocol
  readonly meta?: any
  readonly tag?: Uint8Array
  readonly getTag: Uint8Array

  static get protocol (): string {
    return protocol
  }

  constructor (readonly block: Block<ManifestData>) {
    const manifest = block.value
    this.protocol = manifest.protocol
    this.name = manifest.name
    this.store = manifest.store
    this.access = manifest.access
    this.entry = manifest.entry
    this.identity = manifest.identity
    if (manifest.meta != null) this.meta = manifest.meta
    if (manifest.tag != null) this.tag = manifest.tag

    this.getTag = manifest.tag != null ? manifest.tag : block.cid.bytes
  }

  static async create (manifest: Create): Promise<Manifest> {
    const block = await Blocks.encode({ value: manifest })
    return new Manifest(block)
  }

  static async fetch ({
    blocks,
    address
  }: Fetch): Promise<Manifest> {
    const block: Block<ManifestData> = await blocks.get(address.cid)
    const manifest = this.asManifest({ block })

    if (manifest === null) {
      throw new Error('Manifest.fetch: cid did not resolve to valid manifest')
    }

    return manifest
  }

  static asManifest (manifest: AsManifest<ManifestValue>): Manifest | null {
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

  get address (): Address {
    return new Address(this.block.cid)
  }
}

export { Manifest, Address }
