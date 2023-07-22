import { circuitRelayServer } from 'libp2p/circuit-relay'
import { identifyService } from 'libp2p/identify'
import { gossipsub } from '@chainsafe/libp2p-gossipsub'
import { kadDHT } from '@libp2p/kad-dht'
import { ipnsSelector } from 'ipns/selector'
import { ipnsValidator } from 'ipns/validator'
import { getId, getAddrs } from './circuit-relay-addr.js'
import { getLibp2pDefaults } from './libp2p/defaults.js'
import type { Libp2pOptions } from 'libp2p'

export const getConfig = async (): Promise<Libp2pOptions> => ({
  ...(await getLibp2pDefaults()),
  peerId: await getId(),
  addresses: {
    listen: (await getAddrs()).map(String)
  },
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
