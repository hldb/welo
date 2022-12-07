import type { BlockView } from 'multiformats/interface'

import type { Blocks } from '~blocks/index.js'

import type { Address } from './address.js'

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

export type Create = ManifestData

export interface Fetch {
  blocks: Blocks
  address: Address
}

export interface AsManifest {
  block: BlockView<ManifestData>
}
