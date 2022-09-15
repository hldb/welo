import path from 'path'
import { CID } from 'multiformats/cid'
import { base32 } from 'multiformats/bases/base32'
import { RegistryObj } from './formats/registry'
import { ManifestObj } from './formats/manifest/default'
import { Identity } from './formats/identity/default'

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
  identity: Identity,
  registry: RegistryObj
): ManifestObj => ({
  name,
  store: {
    type: registry.store.star.type
  },
  access: {
    type: registry.access.star.type,
    write: [identity.id]
  },
  entry: {
    type: registry.entry.star.type
  },
  identity: {
    type: registry.identity.star.type
  }
})
