import { Protocol } from '../../manifest/interface'
import protocolPrefix from '../prefix'

const protocol = protocolPrefix

export interface IdentityProtocol extends Protocol {
  protocol: typeof protocol
}

export default protocol
