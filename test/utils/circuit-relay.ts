import { peerIdFromKeys } from '@libp2p/peer-id'
import { Multiaddr, multiaddr } from '@multiformats/multiaddr'
import { mplex } from '@libp2p/mplex'
import { yamux } from '@chainsafe/libp2p-yamux'
import { noise } from '@chainsafe/libp2p-noise'
import { circuitRelayServer } from 'libp2p/circuit-relay'
import { tcp } from '@libp2p/tcp'
import { webSockets } from '@libp2p/websockets'
import * as filters from '@libp2p/websockets/filters'
import { identifyService } from 'libp2p/identify'
import { gossipsub } from '@chainsafe/libp2p-gossipsub'
import { kadDHT } from '@libp2p/kad-dht'
import { ipnsSelector } from 'ipns/selector'
import { ipnsValidator } from 'ipns/validator'
import type { Libp2pOptions } from 'libp2p'
import type { Ed25519PeerId } from '@libp2p/interface-peer-id'

const publicKey = new Uint8Array([8, 1, 18, 32, 59, 59, 118, 163, 48, 43, 45, 125, 112, 49, 65, 51, 243, 119, 220, 67, 206, 11, 217, 202, 42, 208, 11, 106, 113, 216, 41, 159, 52, 165, 253, 42])
const privateKey = new Uint8Array([8, 1, 18, 64, 152, 214, 2, 64, 230, 152, 99, 24, 150, 9, 120, 211, 76, 198, 191, 44, 244, 127, 147, 226, 128, 168, 249, 241, 233, 73, 186, 105, 94, 207, 186, 144, 59, 59, 118, 163, 48, 43, 45, 125, 112, 49, 65, 51, 243, 119, 220, 67, 206, 11, 217, 202, 42, 208, 11, 106, 113, 216, 41, 159, 52, 165, 253, 42])

export const getId = async (): Promise<Ed25519PeerId> => await peerIdFromKeys(publicKey, privateKey) as Ed25519PeerId
export const getAddrs = async (): Promise<Multiaddr[]> => [
  multiaddr('/ip4/127.0.0.1/tcp/8760/p2p/' + (await getId()).toString()),
  multiaddr('/ip4/127.0.0.1/tcp/8761/ws/p2p/' + (await getId()).toString())
]

export const getConfig = async (): Promise<Libp2pOptions> => ({
  peerId: await getId(),
  addresses: {
    listen: (await getAddrs()).map(String)
  },
  transports: [
    tcp(),
    webSockets({ filter: filters.all })
  ],
  connectionEncryption: [noise()],
  streamMuxers: [yamux(), mplex()],
  services: {
    identify: identifyService(),
    pubsub: gossipsub(),
    circuitRelayServer: circuitRelayServer({ advertise: true }),
    dht: kadDHT({
      clientMode: false,
      validators: { ipns: ipnsValidator },
      selectors: { ipns: ipnsSelector }
    })
  }
})
