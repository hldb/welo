import { Protocol } from '../../manifest/interface.js'
import protocolPrefix from '../prefix.js'

const protocol = protocolPrefix

export interface EntryProtocol extends Protocol {
  protocol: typeof protocol
}

export default protocol
