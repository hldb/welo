import { CID } from 'multiformats/cid'

import { Protocol } from '../../manifest/interface.js'
import prefix from '../prefix.js'

const type = 'keyvalue'
const protocol = `${prefix}/${type}`

export interface Config {
  snap?: CID
}

export interface StoreProtocol extends Protocol {
  protocol: typeof protocol
  config: Config
}

export default protocol
