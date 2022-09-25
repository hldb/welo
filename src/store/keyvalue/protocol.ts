import { CID } from 'multiformats/cid'

import { Protocol } from '../../manifest/interface'
import prefix from '../prefix'

const type = 'keyvalue'
const protocol = `${prefix}/${type}`

export interface Config {
  snap: CID
}

export interface Store extends Protocol {
  protocol: typeof protocol
  config?: Config
}

export default protocol
