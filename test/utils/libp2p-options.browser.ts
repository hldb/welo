import { webRTCStar } from '@libp2p/webrtc-star'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { gossipsub, GossipSub } from '@chainsafe/libp2p-gossipsub'
import type { Libp2pOptions } from 'libp2p'
import { identifyService } from 'libp2p/identify'

export function createLibp2pOptions (opts: Libp2pOptions): Libp2pOptions<{ pubsub: GossipSub }> {
  const webRtcStar = webRTCStar()

  const options: Libp2pOptions = {
    addresses: {
      listen: [
        '/dns4/wrtc-star1.par.dwebops.pub/tcp/443/wss/p2p-webrtc-star/'
      ]
    },
    transports: [
      webRtcStar.transport
    ],
    peerDiscovery: [
      webRtcStar.discovery
    ],
    connectionEncryption: [
      noise()
    ],
    streamMuxers: [
      yamux()
    ],
    connectionManager: {
      maxParallelDials: 150, // 150 total parallel multiaddr dials
      dialTimeout: 10e3 // 10 second dial timeout per peer dial
    },
    services: {
      identify: identifyService(),
      pubsub: gossipsub({ emitSelf: true })
    },
    ...opts
  }

  return options
}
