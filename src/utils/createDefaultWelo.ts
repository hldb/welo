import { Welo } from '@/index.js'
import { StaticAccess } from '@/access/static/index.js'
import { Entry } from '@/entry/basal/index.js'
import { Identity } from '@/identity/basal/index.js'
import { Keyvalue } from '@/store/keyvalue/index.js'
import type { Create } from '@/interface.js';

export default (config: Omit<Create, "handlers">) => Welo.create({
  handlers: {
    identity: [Identity],
    access: [StaticAccess],
    store: [Keyvalue],
    entry: [Entry]
  },
  ...config
})
