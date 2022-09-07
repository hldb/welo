import type { Block } from 'multiformats/block.js'
import { RegistryObj } from 'src/registry.js'
import { Blocks } from '../mods/blocks.js'
import { Address } from './address.js'

export interface ManifestObj {
  version?: number
  name?: string
  store?: any
  access?: any
  entry?: any
  identity?: any
  meta?: any
  tag?: Uint8Array
}

class Manifest implements ManifestObj {
  version?: number
  name?: string
  store?: any
  access?: any
  entry?: any
  identity?: any
  meta?: any
  tag?: Uint8Array
  getTag: Uint8Array

  constructor(readonly block: Block<ManifestObj>) {
    const manifest = block.value
    if (manifest.version) this.version = manifest.version
    if (manifest.name) this.name = manifest.name
    if (manifest.store) this.store = manifest.store
    if (manifest.access) this.access = manifest.access
    if (manifest.entry) this.entry = manifest.entry
    if (manifest.identity) this.identity = manifest.identity
    if (manifest.meta) this.meta = manifest.meta
    if (manifest.tag) this.tag = manifest.tag

    this.getTag = manifest.tag || block.cid.bytes
  }

  static async create(manifest: ManifestObj) {
    const block = await Blocks.encode({ value: manifest })
    return new Manifest(block)
  }

  static async fetch({
    blocks,
    address
  }: {
    blocks: Blocks
    address: Address
  }) {
    const block = await blocks.get(address.cid)
    const manifest = await this.asManifest({ block })

    if (manifest === null) {
      throw new Error('Manifest.fetch: cid did not resolve to valid manifest')
    }

    return manifest
  }

  static async asManifest(manifest: any) {
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

  static getComponents(registry: RegistryObj, manifest: Manifest) {
    return {
      Store: registry.store.get(manifest.store.type),
      Access: registry.access.get(manifest.access.type),
      Entry: registry.entry.get(manifest.entry.type),
      Identity: registry.identity.get(manifest.identity.type)
    }
  }

  get address() {
    return new Address(this.block.cid)
  }
}

export { Manifest, Address }
