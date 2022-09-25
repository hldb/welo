import { Block } from 'multiformats/block'
import { Blocks } from '../mods/blocks'
import { Registrant } from '../registry/registrant'
import { Address } from './address'

// specify manifest, entry, and identity as formats later
// export interface Format {
//   protocol: string
// }

export interface Protocol {
  protocol: string
  config?: any
}

export interface ManifestData extends Protocol {
  readonly name: string
  readonly access: Protocol
  readonly entry: Protocol
  readonly identity: Protocol
  readonly store: Protocol
  readonly meta?: any
  readonly tag?: Uint8Array
}

export interface ManifestInterface<ManifestValue> extends ManifestData {
  readonly block: Block<ManifestValue>
  get getTag(): Uint8Array
  get address(): Address
}

export type Create = ManifestData

export interface Fetch {
  blocks: Blocks
  address: Address
}

export type AsManifest<ManifestValue> = ManifestInterface<ManifestValue> | { block: Block<ManifestValue> }

export interface ManifestStatic<ManifestValue> extends Registrant<ManifestInterface<ManifestValue>> {
  create: (create: Create) => Promise<ManifestInterface<ManifestValue>>
  fetch: (fetch: Fetch) => Promise<ManifestInterface<ManifestValue>>
  asManifest: (asManifest: AsManifest<ManifestValue>) => ManifestInterface<ManifestValue> | null
}
