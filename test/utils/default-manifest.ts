import type { IdentityInstance } from '@/identity/interface.js'
import type { ManifestData } from '@/manifest/interface.js'
import staticAccessProtocol from '@/access/static/protocol.js'
import basalEntryProtocol from '@/entry/basal/protocol.js'
import basalIdentityProtocol from '@/identity/basal/protocol.js'
import keyvalueStoreProtocol from '@/store/keyvalue/protocol.js'

export default (
  name: string,
  identity: IdentityInstance<any>
): ManifestData => ({
  name,
  store: {
    protocol: keyvalueStoreProtocol
  },
  access: {
    protocol: staticAccessProtocol,
    config: { write: [identity.id] }
  },
  entry: {
    protocol: basalEntryProtocol
  },
  identity: {
    protocol: basalIdentityProtocol
  }
})
