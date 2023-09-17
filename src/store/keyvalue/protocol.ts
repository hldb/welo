import type { CID } from 'multiformats/cid'

import type { Protocol } from '@/manifest/interface.js'

import { prefix } from '../interface.js'

const protocol = `${prefix}keyvalue` as const

export interface Config extends Record<string, unknown> {
  snap?: CID
}

export type StoreProtocol = Protocol<typeof protocol, Config>

export default protocol
