import { tcp } from '@libp2p/tcp'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { gossipsub } from '@chainsafe/libp2p-gossipsub'
import { identifyService } from 'libp2p/identify'
import type { Libp2pOptions } from 'libp2p'
import type { GossipSub } from '@chainsafe/libp2p-gossipsub'

export function createLibp2pOptions (opts: Libp2pOptions): Libp2pOptions<{ pubsub: GossipSub }> {
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
    services: {
      identify: identifyService(),
      pubsub: gossipsub({ emitSelf: true })
    },
    ...opts
  }

  return options
}
