import { Block } from 'multiformats/block'
import { CID } from 'multiformats/cid'

import { Blocks } from '../mods/blocks'
import { Keychain } from '../mods/keychain'
import { StorageReturn } from '../mods/storage'
import { Registrant } from '../registry/registrant'

export type Gen = string

export interface Get {
  name: string
  identities: StorageReturn
  keychain: Keychain
}

export interface Fetch {
  blocks: Blocks
  auth: CID
}

export type AsIdentity<IdentityValue> = Instance<IdentityValue> | { block: Block<IdentityValue> }

export type Export = Get

export interface Import {
  name: string
  identities?: StorageReturn
  keychain?: Keychain
  kpi: Uint8Array
}

export interface Instance<IdentityValue> {
  name?: string
  block: Block<IdentityValue>
  readonly auth: CID
  readonly id: Uint8Array
  sign: (data: Uint8Array) => Promise<Uint8Array>
  verify: (data: Uint8Array, sig: Uint8Array) => Promise<boolean>
}

export interface Static<IdentityValue> extends Registrant<Instance<IdentityValue>> {
  gen: (gen: Gen) => Promise<Instance<IdentityValue>>
  get: (get: Get) => Promise<Instance<IdentityValue>>
  fetch: (fetch: Fetch) => Promise<Instance<IdentityValue>>
  asIdentity: (asIdentity: AsIdentity<IdentityValue>) => Instance<IdentityValue> | null
  import: (imp: Import) => Promise<Instance<IdentityValue>>
  export: (exp: Export) => Promise<Uint8Array>
  sign: (identity: Instance<IdentityValue>, data: Uint8Array) => Promise<Uint8Array>
  verify: (identity: Instance<IdentityValue>, data: Uint8Array, sig: Uint8Array) => Promise<boolean>
}
