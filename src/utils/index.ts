import path from 'path'
import { CID } from 'multiformats/cid'
import { base32 } from 'multiformats/bases/base32'
import { peerIdFromString } from '@libp2p/peer-id'
import type { PeerId } from '@libp2p/interface-peer-id'

import type { Registry } from '../registry.js'
import type { ManifestData } from '~manifest/interface.js'
import type { IdentityInstance, IdentityStatic } from '~identity/interface.js'
import type { AccessStatic } from '~access/interface.js'
import type { StoreStatic } from '~store/interface.js'
import type { EntryStatic } from '~entry/interface.js'
import type { Manifest } from '~manifest/index.js'

export const cidstring = (cid: CID | string): string => cid.toString(base32)
export const parsedcid = (string: string): CID => CID.parse(string, base32)

export const encodedcid = (cid: CID): Uint8Array => cid.bytes
export const decodedcid = (bytes: Uint8Array): CID => CID.decode(bytes)

export const peerIdString = (peerId: PeerId): string =>
  peerId.toCID().toString(base32)
export const parsedPeerId = (peerId: string): PeerId => peerIdFromString(peerId)

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
