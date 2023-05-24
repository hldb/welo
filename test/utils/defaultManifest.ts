import type { IdentityInstance } from '@/identity/interface.js'
import type { ManifestData } from '@/manifest/interface.js'
import { Keyvalue } from '@/store/keyvalue/index.js'
import { StaticAccess } from '@/access/static/index.js'
import { Entry } from '@/entry/basal/index.js'
import { Identity } from '@/identity/basal/index.js'

export default (
  name: string,
  identity: IdentityInstance<any>
): ManifestData => ({
  name,
  store: {
    protocol: Keyvalue.protocol
  },
  access: {
    protocol: StaticAccess.protocol,
    config: { write: [identity.id] }
  },
  entry: {
    protocol: Entry.protocol
  },
  identity: {
    protocol: Identity.protocol
  }
})
