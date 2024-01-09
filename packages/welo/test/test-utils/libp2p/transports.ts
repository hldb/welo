
import { tcp } from '@libp2p/tcp'
import { webSockets } from '@libp2p/websockets'
import * as filters from '@libp2p/websockets/filters'
import type { Libp2pOptions } from 'libp2p'

export const getTransports = (): Libp2pOptions['transports'] => [
  tcp(),
  webSockets({ filter: filters.all })
]
