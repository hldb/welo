import type { Protocol } from '../../manifest/interface.js'
import protocolPrefix from '../prefix.js'

const protocol: `${typeof protocolPrefix}basal`  = `${protocolPrefix}basal`

export interface EntryProtocol extends Protocol {
  protocol: typeof protocol
}

export default protocol
