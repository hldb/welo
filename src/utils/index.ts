import { CID } from 'multiformats/cid'
import { base32 } from 'multiformats/bases/base32'
import { peerIdFromString } from '@libp2p/peer-id'
import type { PeerId } from '@libp2p/interface-peer-id'

import type { IdentityModule } from '@/identity/interface.js'
import type { AccessModule } from '@/access/interface.js'
import type { StoreModule } from '@/store/interface.js'
import type { EntryModule } from '@/entry/interface.js'

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

export interface Components {
  Access: AccessModule
  entry: EntryModule
  Identity: IdentityModule
  Store: StoreModule
}
