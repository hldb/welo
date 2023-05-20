import { StaticAccess } from '~/access/static/index.js'
import { Entry } from '~/entry/basal/index.js'
import { Identity } from '~/identity/basal/index.js'
import { Keyvalue } from '~/store/keyvalue/index.js'

import { initRegistry, Registry } from '../../src/registry.js'

export const getTestRegistry = (): Registry => {
  const registry = initRegistry()
  registry.store.add(Keyvalue)
  registry.access.add(StaticAccess)
  registry.entry.add(Entry)
  registry.identity.add(Identity)

  return registry
}
