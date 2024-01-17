import type { Access } from '@welo/access'
import type { Protocol } from './protocol.js'

export interface Manifest <T extends Record<string, any> = Record<string, never>>{
  protocol: Protocol
  params: {
    topic: string
    access: Access
    meta: T
  }
}
