import type { Block } from 'multiformats/block.js'
import { RegistryObj } from '../../registry.js'
import { Blocks } from '../../../mods/blocks.js'
import { Address } from '../address.js'

import { Components } from '../../interfaces.js'
import { AccessConfig } from '../../access/default/index.js'
import { StoreConfig } from '../../store/keyvalue/index.js'
import { EntryConfig } from '../../entry/default/index.js'
import { IdentityConfig } from '../../identity/default/index.js'

export interface ManifestObj {
  readonly name: string
  readonly store: StoreConfig
  readonly access: AccessConfig
  readonly entry: EntryConfig
  readonly identity: IdentityConfig
  readonly meta?: any
  readonly tag?: Uint8Array
}

class Manifest implements ManifestObj {
  readonly name: string
  readonly store: StoreConfig
  readonly access: AccessConfig
  readonly entry: EntryConfig
  readonly identity: IdentityConfig
  readonly meta?: any
  readonly tag?: Uint8Array
  readonly getTag: Uint8Array

  constructor (readonly block: Block<ManifestObj>) {
    const manifest = block.value
    this.name = manifest.name
    this.store = manifest.store
    this.access = manifest.access
    this.entry = manifest.entry
    this.identity = manifest.identity
    if (manifest.meta != null) this.meta = manifest.meta
    if (manifest.tag != null) this.tag = manifest.tag

    this.getTag = manifest.tag != null ? manifest.tag : block.cid.bytes
  }

  static async create (manifest: ManifestObj): Promise<Manifest> {
    const block = await Blocks.encode({ value: manifest })
    return new Manifest(block)
  }

  static async fetch ({
    blocks,
    address
  }: {
    blocks: Blocks
    address: Address
  }): Promise<Manifest> {
    const block = await blocks.get(address.cid)
    const manifest = this.asManifest({ block })

    if (manifest === null) {
      throw new Error('Manifest.fetch: cid did not resolve to valid manifest')
    }

    return manifest
  }

  static asManifest (manifest: any): Manifest | null {
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

  static getComponents (registry: RegistryObj, manifest: Manifest): Components {
    return {
      Store: registry.store.get(manifest.store.type),
      Access: registry.access.get(manifest.access.type),
      Entry: registry.entry.get(manifest.entry.type),
      Identity: registry.identity.get(manifest.identity.type)
    }
  }

  get address (): Address {
    return new Address(this.block.cid)
  }
}

export { Manifest, Address }
