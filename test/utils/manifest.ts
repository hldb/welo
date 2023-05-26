import { Manifest } from '@/manifest/index.js'
import type { ManifestData } from '@/manifest/interface.js'
import staticAccessProtocol from '@/access/static/protocol.js'
import basalEntryProtocol from '@/entry/basal/protocol.js'
import { Identity } from '@/identity/basal/index.js'
import { Keyvalue } from '@/store/keyvalue/index.js'

export const getTestManifestConfig = (
  name: string
): ManifestData => ({
  name,
  store: {
    protocol: Keyvalue.protocol
  },
  access: {
    protocol: staticAccessProtocol,
    config: { write: [] }
  },
  entry: {
    protocol: basalEntryProtocol
  },
  identity: {
    protocol: Identity.protocol
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
