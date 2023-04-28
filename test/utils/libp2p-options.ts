import { tcp } from '@libp2p/tcp'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { gossipsub } from '@chainsafe/libp2p-gossipsub'
import type { Libp2pOptions } from 'libp2p'

export function createLibp2pOptions (opts: Libp2pOptions): Libp2pOptions {
  const options: Libp2pOptions = {
    addresses: {
      listen: [
        '/ip4/0.0.0.0/tcp/0'
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
    nat: {
      enabled: false
    },
    pubsub: gossipsub({ emitSelf: true }),
    ...opts
  }

  return options
}
