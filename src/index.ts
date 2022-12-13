/**
 * peer-to-peer, collaborative states using merkle-crdts
 *
 * @packageDocumentation
 */

import { Opal as _Opal } from './opal.js'

import { LevelDatastore } from 'datastore-level'
import { Replicator } from '~replicator/index.js'

import { StaticAccess } from '~access/static/index.js'
import { Entry } from '~entry/basal/index.js'
import { Identity } from '~identity/basal/index.js'
import { Keyvalue } from '~store/keyvalue/index.js'

_Opal.registry.access.add(StaticAccess)
_Opal.registry.entry.add(Entry)
_Opal.registry.identity.add(Identity)
_Opal.registry.store.add(Keyvalue)

_Opal.Datastore = LevelDatastore
_Opal.Replicator = Replicator

export { _Opal as Opal }

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
