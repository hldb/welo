import { prefix } from '../interface.js'
import type { Protocol } from '@/manifest/interface.js'

const protocol = `${prefix}static` as const

export interface Config extends Record<string, unknown> {
  write: Array<string | Uint8Array>
}

export type AccessProtocol = Protocol<typeof protocol, Config>

export default protocol
