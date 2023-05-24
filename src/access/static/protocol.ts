import type { Protocol } from '@/manifest/interface.js'

import protocolPrefix from '../prefix.js'

const protocol = `${protocolPrefix}static` as const

export interface Config {
  write: Array<string | Uint8Array>
}

export interface AccessProtocol extends Protocol {
  protocol: string
  config: Config
}

export default protocol
