import { tcp } from '@libp2p/tcp'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import type { Libp2pOptions } from 'libp2p'
import services, { type Services } from './libp2p-services.js'

export function createLibp2pOptions (opts?: Libp2pOptions): Libp2pOptions<Services> {
  const options: Libp2pOptions = {
    addresses: {
      listen: [
        '/ip4/127.0.0.1/tcp/0'
      ]
    },
    transports: [
      tcp()
    ],
    connectionEncryption: [
      noise()
    ],
    streamMuxers: [
      yamux()
    ],
    services,
    ...opts
  }

  return options
}
