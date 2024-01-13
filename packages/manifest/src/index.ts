import type { Access } from '@welo/access'
import type { Protocol } from './protocol.js'

export interface Manifest <T extends Record<string, any> = Record<string, never>>{
  protocol: Protocol
  access: Access
  topic: string
  meta: T
}

// 10kb max size?
export const validate = <M>(manifest: M): void => {}
