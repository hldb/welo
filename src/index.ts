/**
 * peer-to-peer, collaborative states using merkle-crdts
 *
 * @packageDocumentation
 */

export { Welo, createWelo } from '@/welo.js'
export { StaticAccess, staticAccess } from '@/access/static/index.js'
export { Entry, basalEntry } from '@/entry/basal/index.js'
export { Identity, basalIdentity } from '@/identity/basal/index.js'
export { Keyvalue, keyvalueStore } from '@/store/keyvalue/index.js'
export { liveReplicator } from '@/replicator/live/index.js'
export { pubsubReplicator } from '@/replicator/pubsub/index.js'
export { bootstrapReplicator } from '@/replicator/bootstrap/index.js'
export { Address } from '@/manifest/index.js'
export type { Manifest } from '@/manifest/index.js'
export type { Playable } from '@/utils/playable.js'
export type { Database } from './database.js'
export type {
  Config,
  WeloInit as Create,
  Determine,
  // FetchOptions,
  OpenOptions
} from './interface.js'
