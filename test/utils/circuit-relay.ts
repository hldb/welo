import { mplex } from '@libp2p/mplex'
import { yamux } from '@chainsafe/libp2p-yamux'
import { noise } from '@chainsafe/libp2p-noise'
import { circuitRelayServer } from '@libp2p/circuit-relay-v2'
import { tcp } from '@libp2p/tcp'
import { webSockets } from '@libp2p/websockets'
import * as filters from '@libp2p/websockets/filters'
import { identify } from '@libp2p/identify'
import { gossipsub } from '@chainsafe/libp2p-gossipsub'
import { kadDHT } from '@libp2p/kad-dht'
import { ipnsSelector } from 'ipns/selector'
import { ipnsValidator } from 'ipns/validator'
import type { Libp2pOptions } from 'libp2p'
import { getId, getAddrs } from './circuit-relay-addr.js'

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
    identify: identify(),
    pubsub: gossipsub(),
    circuitRelayServer: circuitRelayServer(),
    dht: kadDHT({
      clientMode: false,
      validators: { ipns: ipnsValidator },
      selectors: { ipns: ipnsSelector }
    })
  }
})
