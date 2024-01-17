import type { Access } from '@welo/access'
import type { Protocol } from './protocol.js'

export interface Manifest <T extends any = unknown> {
  protocol: Protocol
  params: {
    topic: string
    access: Access
    meta: T
  }
}
