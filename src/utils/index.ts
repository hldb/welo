import path from 'path'
import { CID } from 'multiformats/cid'
import { base32 } from 'multiformats/bases/base32'
import { Registry } from '../registry'
import protocol from '../manifest/default/protocol'
import { ManifestData } from '../manifest/interface'
import { IdentityInstance, IdentityStatic } from '../identity/interface'
import { AccessStatic } from '../access/interface'
import { StoreStatic } from '../store/interface'
import { EntryStatic } from '../entry/interface'
import { Manifest } from '../manifest/default'

export const cidstring = (cid: CID | string): string => cid.toString(base32)
export const parsedcid = (string: string): CID => CID.parse(string, base32)

export interface DirsReturn {
  [name: string]: string
}

export const dirs = (root: string): DirsReturn =>
  Object.fromEntries(
    ['databases', 'identities', 'keychain'].map((k) => [k, path.join(root, k)])
  )

export const defaultManifest = (
  name: string,
  identity: IdentityInstance<any>,
  registry: Registry
): ManifestData => ({
  protocol,
  name,
  store: {
    protocol: registry.store.star.protocol
  },
  access: {
    protocol: registry.access.star.protocol,
    config: { write: [identity.id] }
  },
  entry: {
    protocol: registry.entry.star.protocol
  },
  identity: {
    protocol: registry.identity.star.protocol
  }
})

interface Components {
  Access: AccessStatic
  Entry: EntryStatic<any>
  Identity: IdentityStatic<any>
  Store: StoreStatic
}

export const getComponents = (
  registry: Registry,
  manifest: Manifest
): Components => ({
  Access: registry.access.get(manifest.access.protocol),
  Entry: registry.entry.get(manifest.entry.protocol),
  Identity: registry.identity.get(manifest.identity.protocol),
  Store: registry.store.get(manifest.store.protocol)
})
