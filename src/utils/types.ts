import type { Libp2p } from 'libp2p'
import type { AbortOptions } from 'ipfs-core-types'
import type { PreloadOptions } from 'ipfs-core-types/src/utils'

export type KeyChain = Libp2p['keychain']

export type FetchOptions = AbortOptions & PreloadOptions
