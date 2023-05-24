import type { CID } from 'multiformats/cid'

import type { Protocol } from '@/manifest/interface.js'

import { prefix } from '../interface.js'

const protocol = `${prefix}keyvalue` as const

export interface Config {
  snap?: CID
}

export interface StoreProtocol extends Protocol {
  protocol: typeof protocol
  config: Config
}

export default protocol
