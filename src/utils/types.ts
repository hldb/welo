import type { Libp2p } from 'libp2p'
import type { BaseDatastore } from 'datastore-core'
import type { AnyLink } from '@alanshaw/pail/link'

export type KeyChain = Libp2p['keychain']

export interface IpldDatastore<L extends AnyLink> extends BaseDatastore {
  root: L
}

// export interface FetchOptions extends AbortOptions, PreloadOptions {}
