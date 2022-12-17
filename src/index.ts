/**
 * peer-to-peer, collaborative states using merkle-crdts
 *
 * @packageDocumentation
 */

import { Welo as _Welo } from './welo.js'

import { LevelDatastore } from 'datastore-level'
import { Replicator } from '~replicator/index.js'

import { StaticAccess } from '~access/static/index.js'
import { Entry } from '~entry/basal/index.js'
import { Identity } from '~identity/basal/index.js'
import { Keyvalue } from '~store/keyvalue/index.js'

_Welo.registry.access.add(StaticAccess)
_Welo.registry.entry.add(Entry)
_Welo.registry.identity.add(Identity)
_Welo.registry.store.add(Keyvalue)

_Welo.Datastore = LevelDatastore
_Welo.Replicator = Replicator

export { _Welo as Welo }

export type { Manifest, Address } from '~manifest/index.js'
export type { Playable } from '~utils/playable.js'
export type { Database } from './database.js'
export type {
  Config,
  Create,
  Determine,
  FetchOptions,
  OpenOptions
} from './interface.js'
