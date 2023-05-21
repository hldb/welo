import { Manifest } from '@/manifest/index.js'
import type { ManifestData } from '@/manifest/interface.js'

import type { Registry } from '../../src/registry.js'

export const getTestManifestConfig = (
  name: string,
  registry: Registry
): ManifestData => ({
  name,
  store: {
    protocol: registry.store.star.protocol
  },
  access: {
    protocol: registry.access.star.protocol,
    config: { write: [] }
  },
  entry: {
    protocol: registry.entry.star.protocol
  },
  identity: {
    protocol: registry.identity.star.protocol
  }
})

export const getTestManifest = async (
  name: string,
  registry: Registry,
  overrides: object = {}
): Promise<Manifest> =>
  await Manifest.create({
    ...getTestManifestConfig(name, registry),
    ...overrides
  })
