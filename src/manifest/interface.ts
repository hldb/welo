import { Block } from 'multiformats/block'

import { Blocks } from '../mods/blocks.js'
import { Address } from './address.js'

export interface Protocol {
  readonly protocol: string
  readonly config?: any
}

export interface ManifestData {
  readonly name: string
  readonly access: Protocol
  readonly entry: Protocol
  readonly identity: Protocol
  readonly store: Protocol
  readonly meta?: any
  readonly tag?: Uint8Array
}

export interface ManifestInstance<Value> extends ManifestData {
  readonly block: Block<Value>
  get getTag(): Uint8Array
  get address(): Address
}

export type Create = ManifestData

export interface Fetch {
  blocks: Blocks
  address: Address
}

export type AsManifest<Value> = ManifestInstance<Value> | { block: Block<Value> }

export interface ManifestStatic<Value> {
  new(props: any): ManifestInstance<Value>
  create: (create: Create) => Promise<ManifestInstance<Value>>
  fetch: (fetch: Fetch) => Promise<ManifestInstance<Value>>
  asManifest: (asManifest: AsManifest<Value>) => ManifestInstance<Value> | null
}
