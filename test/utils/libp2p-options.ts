import { tcp } from '@libp2p/tcp'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import type { Libp2pOptions } from 'libp2p'
import services, { type Services } from './libp2p-services.js'
import { bootstrap } from '@libp2p/bootstrap'
import { getAddrs } from './circuit-relay-addr.js'

export async function createLibp2pOptions (opts?: Libp2pOptions): Promise<Libp2pOptions<Services>> {
  const options: Libp2pOptions = {
    addresses: {
      listen: [
        '/ip4/127.0.0.1/tcp/0'
      ]
    },
    peerDiscovery: [
      bootstrap({ list: (await getAddrs()).map(String) })
    ],
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
