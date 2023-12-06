import type { WeloInit } from '@/interface.js'
import { staticAccess } from '@/access/static/index.js'
import { basalEntry } from '@/entry/basal/index.js'
import { basalIdentity } from '@/identity/basal/index.js'
import { createWelo, type Welo } from '@/index.js'
import { liveReplicator } from '@/replicator/live/index.js'
import { keyvalueStore } from '@/store/keyvalue/index.js'

export default async (config: Omit<WeloInit, 'components' | 'replicators'> & Partial<WeloInit>): Promise<Welo> => createWelo({
  replicators: [liveReplicator()],

  components: {
    identity: [basalIdentity()],
    access: [staticAccess()],
    store: [keyvalueStore()],
    entry: [basalEntry()]
  },

  ...config
})
