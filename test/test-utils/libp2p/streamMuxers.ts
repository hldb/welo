import { yamux } from '@chainsafe/libp2p-yamux'
import { mplex } from '@libp2p/mplex'
import type { Libp2pOptions } from 'libp2p'

export const getStreamMuxers = (): Libp2pOptions['streamMuxers'] => [
  yamux(),
  mplex()
]
