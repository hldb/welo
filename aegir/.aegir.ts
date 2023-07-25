import { readFileSync } from 'node:fs'
import { Libp2p, createLibp2p } from 'libp2p'
import { circuitRelayServer, circuitRelayTransport } from 'libp2p/circuit-relay'
import { identifyService } from 'libp2p/identify'
import { gossipsub } from '@chainsafe/libp2p-gossipsub'
import { kadDHT } from '@libp2p/kad-dht'
import { ipnsSelector } from 'ipns/selector'
import { ipnsValidator } from 'ipns/validator'
import { createEd25519PeerId } from '@libp2p/peer-id-factory'
import { webSockets } from '@libp2p/websockets'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { mplex } from '@libp2p/mplex'
import { WebSockets } from '@multiformats/mafmt'

interface Before {
  env: {
    W3_TOKEN: string | null
    RELAY_MULTIADDR: string | null
  }
  libp2p: Libp2p
}

/** @type {import('aegir').PartialOptions} */
export default {
  test: {
    before: async () => {
      // get web3.storage token from shell or .env file
      let W3_TOKEN: null | string = null
      if (typeof process.env.W3_TOKEN === 'string' && process.env.W3_TOKEN.length > 0) {
        W3_TOKEN = process.env.W3_TOKEN
      } else {
        try {
          W3_TOKEN = readFileSync('.w3_token', { encoding: 'utf-8' }).split('\n')[0]
        } catch {}
      }

      const peerId = await createEd25519PeerId()
      const libp2p = await createLibp2p({
        peerId,
        addresses: {
          listen: [
            '/ip4/127.0.0.1/tcp/0/ws'
          ]
        },
        connectionManager: {
          inboundConnectionThreshold: Infinity,
          minConnections: 0
        },
        transports: [
          circuitRelayTransport(),
          webSockets()
        ],
        streamMuxers: [
          yamux(),
          mplex()
        ],
        connectionEncryption: [
          noise()
        ],
        services: {
          identify: identifyService(),
          pubsub: gossipsub(),
          dht: kadDHT({
            clientMode: false,
            validators: {
              ipns: ipnsValidator
            },
            selectors: {
              ipns: ipnsSelector
            }
          }),
          relay: circuitRelayServer({
            reservations: {
              maxReservations: Infinity
            }
          })
        }
      })

      return {
        libp2p,
        env: {
          W3_TOKEN,
          RELAY_MULTIADDR: libp2p.getMultiaddrs().filter(ma => WebSockets.matches(ma)).pop()
        }
      }
    },
    after: async (_: unknown, before: Before) => {
      await before.libp2p.stop()
    }
  }
}
