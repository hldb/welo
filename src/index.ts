import { Opal as _Opal } from './opal.js'

import { LevelStorage } from '~storage/index.js'
import { Keychain } from '~keychain/index.js'
// import { Replicator } from '~replicator/index.js'

import { StaticAccess } from '~access/static/index.js'
import { Entry } from '~entry/basal/index.js'
import { Identity } from '~identity/basal/index.js'
import { Keyvalue } from '~store/keyvalue/index.js'

_Opal.registry.access.add(StaticAccess)
_Opal.registry.entry.add(Entry)
_Opal.registry.identity.add(Identity)
_Opal.registry.store.add(Keyvalue)

_Opal.Storage = LevelStorage
_Opal.Keychain = Keychain
// _Opal.Replicator = Replicator

export const Opal = _Opal
