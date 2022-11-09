import { Block } from 'multiformats/block'
import { CID } from 'multiformats/cid'

import { Blocks } from '../blocks/index.js'
import { Keychain } from '../keychain/index.js'
import { StorageReturn } from '../storage/index.js'
import { Registrant } from '../registry/registrant.js'

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

export type AsIdentity<Value> =
  | IdentityInstance<Value>
  | { block: Block<Value> }

export type Export = Get

export interface Import {
  name: string
  identities?: StorageReturn
  keychain?: Keychain
  kpi: Uint8Array
}

export interface IdentityInstance<Value> {
  name?: string
  block: Block<Value>
  readonly auth: CID
  readonly id: Uint8Array
  sign: (data: Uint8Array) => Promise<Uint8Array>
  verify: (data: Uint8Array, sig: Uint8Array) => Promise<boolean>
}

export interface IdentityStatic<Value> extends Registrant {
  new (props: any): IdentityInstance<Value>
  gen: (gen: Gen) => Promise<IdentityInstance<Value>>
  get: (get: Get) => Promise<IdentityInstance<Value>>
  fetch: (fetch: Fetch) => Promise<IdentityInstance<Value>>
  asIdentity: (asIdentity: AsIdentity<Value>) => IdentityInstance<Value> | null
  import: (imp: Import) => Promise<IdentityInstance<Value>>
  export: (exp: Export) => Promise<Uint8Array>
  sign: (
    identity: IdentityInstance<Value>,
    data: Uint8Array
  ) => Promise<Uint8Array>
  verify: (
    identity: IdentityInstance<Value>,
    data: Uint8Array,
    sig: Uint8Array
  ) => Promise<boolean>
}
