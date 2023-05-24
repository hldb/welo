import type { Protocol } from '@/manifest/interface.js'

import { prefix } from '../interface.js'

const protocol = `${prefix}basal` as const

export type IdentityProtocol = Protocol<typeof protocol>

export default protocol
