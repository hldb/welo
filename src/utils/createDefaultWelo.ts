import { LevelDatastore } from 'datastore-level'

import { Welo } from '@/index.js'
import { createStaticAccess } from '@/access/static/index.js'
import { createBasalEntry } from '@/entry/basal/index.js'
import { createBasalIdentity } from '@/identity/basal/index.js'
import { createKeyValueStore } from '@/store/keyvalue/index.js'
import { createLiveReplicator } from '@/replicator/live/index.js'
import type { Create } from '@/interface.js'

export default async (config: Omit<Create, 'handlers' | 'datastore' | 'replicators'>): Promise<Welo> => await Welo.create({
  datastore: LevelDatastore,
  replicators: [createLiveReplicator()],

  handlers: {
    identity: [createBasalIdentity()],
    access: [createStaticAccess()],
    store: [createKeyValueStore()],
    entry: [createBasalEntry()]
  },

  ...config
})
