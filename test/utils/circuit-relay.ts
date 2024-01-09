import { gossipsub } from '@chainsafe/libp2p-gossipsub'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { circuitRelayServer } from '@libp2p/circuit-relay-v2'
import { identify } from '@libp2p/identify'
import { kadDHT } from '@libp2p/kad-dht'
import { mplex } from '@libp2p/mplex'
import { tcp } from '@libp2p/tcp'
import { webSockets } from '@libp2p/websockets'
import * as filters from '@libp2p/websockets/filters'
import { ipnsSelector } from 'ipns/selector'
import { ipnsValidator } from 'ipns/validator'
import { getId, getAddrs } from './circuit-relay-addr.js'
import type { Libp2pOptions } from 'libp2p'

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
