import type { IdentityInstance } from '@/identity/interface.js'
import type { ManifestData } from '@/manifest/interface.js'
import { Keyvalue } from '@/store/keyvalue/index.js'
import staticAccessProtocol from '@/access/static/protocol.js'
import basalEntryProtocol from '@/entry/basal/protocol.js'
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
    protocol: staticAccessProtocol,
    config: { write: [identity.id] }
  },
  entry: {
    protocol: basalEntryProtocol
  },
  identity: {
    protocol: Identity.protocol
  }
})
