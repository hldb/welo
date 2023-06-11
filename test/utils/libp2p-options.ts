import { tcp } from '@libp2p/tcp'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { type GossipSub, gossipsub } from '@chainsafe/libp2p-gossipsub'
import { kadDHT, type DualKadDHT } from '@libp2p/kad-dht'
import { identifyService } from 'libp2p/identify'
import { ipnsSelector } from 'ipns/selector'
import { ipnsValidator } from 'ipns/validator'
import type { Libp2pOptions } from 'libp2p'
import type { ServiceMap } from '@libp2p/interface-libp2p'

interface Services extends ServiceMap {
  pubsub: GossipSub
  dht: DualKadDHT
}

export function createLibp2pOptions (opts?: Libp2pOptions): Libp2pOptions<Services> {
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
      pubsub: gossipsub({ emitSelf: true }),
      dht: kadDHT({
        clientMode: false,
        validators: { ipns: ipnsValidator },
        selectors: { ipns: ipnsSelector }
      })
    },
    ...opts
  }

  return options
}
