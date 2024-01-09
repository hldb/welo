import { webSockets } from '@libp2p/websockets'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import type { Libp2pOptions } from 'libp2p'
import services, { type Services } from './libp2p-services'
import * as filters from '@libp2p/websockets/filters'
import { bootstrap } from '@libp2p/bootstrap'
import { mplex } from '@libp2p/mplex'
import { webRTC, webRTCDirect } from '@libp2p/webrtc'
import { circuitRelayTransport } from 'libp2p/circuit-relay'
import { getAddrs } from './circuit-relay-addr'

export async function createLibp2pOptions (opts: Libp2pOptions): Promise<Libp2pOptions<Services>> {
  const options: Libp2pOptions = {
    addresses: {
      listen: [
        '/webrtc'
      ]
    },
    transports: [
      webSockets({ filter: filters.all }),
      circuitRelayTransport({
        discoverRelays: 1
      }),
      webRTC(),
      webRTCDirect()
    ],
    peerDiscovery: [
      bootstrap({ list: [...(await getAddrs()).map(String), '/ip4/127.0.0.1/tcp/8001/ws/p2p/12D3KooWDoap6J1qAP17dvR8KgaknSZSFSamxFeggEc5Qzecqto3'] })
    ],
    connectionEncryption: [
      noise()
    ],
    streamMuxers: [
      yamux(), mplex()
    ],
    services,
    ...opts
  }

  return options
}
