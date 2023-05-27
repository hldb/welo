import { MemoryDatastore } from 'datastore-core'

import { Welo } from '@/index.js'
import { staticAccess } from '@/access/static/index.js'
import { basalEntry } from '@/entry/basal/index.js'
import { basalIdentity } from '@/identity/basal/index.js'
import { keyvalueStore } from '@/store/keyvalue/index.js'
import { liveReplicator } from '@/replicator/live/index.js'
import type { Create } from '@/interface.js'

export default async (config: Omit<Create, 'handlers' | 'datastore' | 'replicators'>): Promise<Welo> => await Welo.create({
  datastore: new MemoryDatastore(),
  replicators: [liveReplicator()],

  handlers: {
    identity: [basalIdentity()],
    access: [staticAccess()],
    store: [keyvalueStore()],
    entry: [basalEntry()]
  },

  ...config
})
