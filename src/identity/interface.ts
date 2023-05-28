import type { KeyChain } from '@libp2p/interface-keychain'
import type { BlockView } from 'multiformats/interface'
import type { CID } from 'multiformats/cid'
import type { Datastore } from 'interface-datastore'

import type { Blocks } from '@/blocks/index.js'
import { HLDB_PREFIX } from '@/utils/constants.js'
import type { Component } from '@/interface.js'

export type Gen = string

export interface Get {
  name: string
  identities: Datastore
  keychain: KeyChain
}

export interface Fetch {
  blocks: Blocks
  auth: CID
}

export type AsIdentity<Value> =
  | IdentityInstance<Value>
  | { block: BlockView<Value> }

export type Export = Get

export interface Import {
  name: string
  identities?: Datastore
  keychain?: KeyChain
  kpi: Uint8Array
}

export interface IdentityInstance<Value> {
  name?: string
  block: BlockView<Value>
  readonly auth: CID
  readonly id: Uint8Array
  sign: (data: Uint8Array) => Promise<Uint8Array>
  verify: (data: Uint8Array, sig: Uint8Array) => Promise<boolean>
}

export interface IdentityComponent<T extends IdentityInstance<unknown> = IdentityInstance<unknown>, P extends string = string> extends Component<P> {
  gen: (gen: Gen) => Promise<T>
  get: (get: Get) => Promise<T>
  fetch: (fetch: Fetch) => Promise<T>
  asIdentity: (asIdentity: AsIdentity<unknown>) => T | null
  import: (imp: Import) => Promise<T>
  export: (exp: Export) => Promise<Uint8Array>
  sign: (
    identity: AsIdentity<unknown>,
    data: Uint8Array
  ) => Promise<Uint8Array>
  verify: (
    identity: AsIdentity<unknown>,
    data: Uint8Array,
    sig: Uint8Array
  ) => Promise<boolean>
}

export const prefix = `${HLDB_PREFIX}identity/` as const
