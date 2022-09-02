
import { Opal as _Opal } from './opal.js'

import { Storage } from './util.js'
import { Keychain } from './keychain/index.js'
import { Replicator } from './replicator/index.js'

import { StaticAccess } from './manifest/access/static.js'
import { Entry } from './manifest/entry/index.js'
import { Identity } from './manifest/identity/index.js'
import { Keyvalue } from './manifest/store/keyvalue.js'

_Opal.registry.access.add(StaticAccess)
_Opal.registry.entry.add(Entry)
_Opal.registry.identity.add(Identity)
_Opal.registry.store.add(Keyvalue)

_Opal.Storage = Storage
_Opal.Keychain = Keychain
_Opal.Replicator = Replicator

export const Opal = _Opal
