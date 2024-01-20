import type { Protocol } from './protocol.js'
import type { EpochAccess } from '@welo/access'

export interface Manifest <T = unknown> {
  protocol: Protocol
  params: {
    topic: string
    access: EpochAccess
    meta: T
  }
}
