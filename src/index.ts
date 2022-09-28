import { Opal as _Opal } from './opal.js'

import { LevelStorage } from './mods/storage.js'
import { Keychain } from './mods/keychain/index.js'
// import { Replicator } from './mods/replicator/index.js'

import { StaticAccess } from './access/default/index.js'
import { Entry } from './entry/default/index.js'
import { Identity } from './identity/default/index.js'
import { Keyvalue } from './store/keyvalue/index.js'

_Opal.registry.access.add(StaticAccess)
_Opal.registry.entry.add(Entry)
_Opal.registry.identity.add(Identity)
_Opal.registry.store.add(Keyvalue)

_Opal.Storage = LevelStorage
_Opal.Keychain = Keychain
// _Opal.Replicator = Replicator

export const Opal = _Opal
