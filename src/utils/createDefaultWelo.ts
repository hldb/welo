import { LevelDatastore } from 'datastore-level'

import { Welo } from '@/index.js'
import { StaticAccess } from '@/access/static/index.js'
import { Entry } from '@/entry/basal/index.js'
import { Identity } from '@/identity/basal/index.js'
import { Keyvalue } from '@/store/keyvalue/index.js'
import { LiveReplicator } from '@/replicator/live/index.js'
import type { Create } from '@/interface.js'

export default async (config: Omit<Create, 'handlers' | 'datastore' | 'replicators'>): Promise<Welo> => await Welo.create({
  datastore: LevelDatastore,
  replicators: [LiveReplicator],

  handlers: {
    identity: [Identity],
    access: [StaticAccess],
    store: [Keyvalue],
    entry: [Entry]
  },

  ...config
})
