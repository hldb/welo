import { prefix } from '../interface.js'
import type { Protocol } from '@/manifest/interface.js'

const protocol = `${prefix}basal` as const

export type IdentityProtocol = Protocol<typeof protocol>

export default protocol
