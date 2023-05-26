import { Manifest } from '@/manifest/index.js'
import type { ManifestData } from '@/manifest/interface.js'
import staticAccessProtocol from '@/access/static/protocol.js'
import basalEntryProtocol from '@/entry/basal/protocol.js'
import basalIdentityProtocol from '@/identity/basal/protocol.js'
import keyvalueStoreProtocol from '@/store/keyvalue/protocol.js'

export const getTestManifestConfig = (
  name: string
): ManifestData => ({
  name,
  store: {
    protocol: keyvalueStoreProtocol
  },
  access: {
    protocol: staticAccessProtocol,
    config: { write: [] }
  },
  entry: {
    protocol: basalEntryProtocol
  },
  identity: {
    protocol: basalIdentityProtocol
  }
})

export const getTestManifest = async (
  name: string,
  overrides: object = {}
): Promise<Manifest> =>
  await Manifest.create({
    ...getTestManifestConfig(name),
    ...overrides
  })
