import { bootstrap } from '@libp2p/bootstrap'
import { getAddrs } from '../circuit-relay-addr.js'
import type { Libp2pOptions } from 'libp2p'

export const getPeerDiscovery = async (): Promise<Libp2pOptions['peerDiscovery']> => [
  bootstrap({ list: (await getAddrs()).map(String) })
]
