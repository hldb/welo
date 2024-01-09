import { noise } from '@chainsafe/libp2p-noise'
import type { Libp2pOptions } from 'libp2p'

export const getConnectionEncryption = (): Libp2pOptions['connectionEncryption'] => [noise()]
