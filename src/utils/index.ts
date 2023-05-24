import path from 'path'
import { CID } from 'multiformats/cid'
import { base32 } from 'multiformats/bases/base32'
import { peerIdFromString } from '@libp2p/peer-id'
import type { PeerId } from '@libp2p/interface-peer-id'

import type { ManifestData } from '@/manifest/interface.js'
import type { IdentityInstance, IdentityStatic } from '@/identity/interface.js'
import type { AccessStatic } from '@/access/interface.js'
import type { StoreStatic } from '@/store/interface.js'
import type { EntryStatic } from '@/entry/interface.js'
import { StaticAccess } from '@/access/static/index.js'
import { Keyvalue } from '@/store/keyvalue/index.js'
import { Entry } from '@/entry/basal/index.js'
import { Identity } from '@/identity/basal/index.js'

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
  identity: IdentityInstance<any>
): ManifestData => ({
  name,
  store: {
    protocol: Keyvalue.protocol
  },
  access: {
    protocol: StaticAccess.protocol,
    config: { write: [identity.id] }
  },
  entry: {
    protocol: Entry.protocol
  },
  identity: {
    protocol: Identity.protocol
  }
})

interface Components {
  Access: AccessStatic
  Entry: EntryStatic<any>
  Identity: IdentityStatic<any>
  Store: StoreStatic
}

export const getComponents = (): Components => ({
  Access: StaticAccess,
  Store: Keyvalue,
  Entry,
  Identity
})
