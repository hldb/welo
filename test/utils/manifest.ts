import { Manifest } from '@/manifest/index.js'
import type { ManifestData } from '@/manifest/interface.js'
import staticAccessProtocol from '@/access/static/protocol.js'
import basalEntryProtocol from '@/entry/basal/protocol.js'
import basalIdentityProtocol from '@/identity/basal/protocol.js'
import keyvalueStoreProtocol from '@/store/keyvalue/protocol.js'
import type { IdentityInstance } from '@/identity/interface.js'

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

export const getDefaultManifest = (
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
