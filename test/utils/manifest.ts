import { Manifest } from '@/manifest/index.js'
import type { ManifestData } from '@/manifest/interface.js'
import { StaticAccess } from '@/access/static/index.js'
import { Entry } from '@/entry/basal/index.js'
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
    protocol: StaticAccess.protocol,
    config: { write: [] }
  },
  entry: {
    protocol: Entry.protocol
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
