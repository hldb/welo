import { bootstrap } from '@libp2p/bootstrap'
import type { Libp2pOptions } from 'libp2p'
import { multiaddr, type Multiaddr } from '@multiformats/multiaddr'

let relayMultiaddr: Multiaddr
try {
  relayMultiaddr = multiaddr(process.env.RELAY_MULTIADDR)
} catch (e) {
  throw new Error('unable to parse process.env.RELAY_MULTIADDR')
}

export const getPeerDiscovery = async (): Promise<Libp2pOptions['peerDiscovery']> => [
  bootstrap({ list: [relayMultiaddr.toString()] })
]
