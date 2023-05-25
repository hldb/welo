/**
 * peer-to-peer, collaborative states using merkle-crdts
 *
 * @packageDocumentation
 */

export { Welo } from '@/welo.js'
export { StaticAccess } from '@/access/static/index.js'
export { Entry } from '@/entry/basal/index.js'
export { Identity } from '@/identity/basal/index.js'
export { Keyvalue } from '@/store/keyvalue/index.js'
export type { Manifest, Address } from '@/manifest/index.js'
export type { Playable } from '@/utils/playable.js'
export type { Database } from './database.js'
export type {
  Config,
  Create,
  Determine,
  // FetchOptions,
  OpenOptions
} from './interface.js'
