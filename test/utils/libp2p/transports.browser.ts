import { webSockets } from '@libp2p/websockets'
import type { Libp2pOptions } from 'libp2p'
import * as filters from '@libp2p/websockets/filters'
import { webRTC, webRTCDirect } from '@libp2p/webrtc'
import { circuitRelayTransport } from 'libp2p/circuit-relay'

export const getTransports = (): Libp2pOptions['transports'] => [
  webSockets({ filter: filters.all }),
  circuitRelayTransport({
    discoverRelays: 1
  }),
  webRTC(),
  webRTCDirect()
]
