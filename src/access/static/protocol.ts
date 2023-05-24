import type { Protocol } from '@/manifest/interface.js'

import { prefix } from '../interface.js'

const protocol = `${prefix}static` as const

export interface Config {
  write: Array<string | Uint8Array>
}

export type AccessProtocol = Protocol<typeof protocol, Config>

export default protocol
