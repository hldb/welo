import { prefix } from '../interface.js'
import type { Protocol } from '@/manifest/interface.js'
import type { CID } from 'multiformats/cid'

const protocol = `${prefix}keyvalue` as const

export interface Config extends Record<string, unknown> {
  snap?: CID
}

export type StoreProtocol = Protocol<typeof protocol, Config>

export default protocol
