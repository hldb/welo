import { Protocol } from '../../manifest/interface'
import protocolPrefix from '../prefix'

const protocol = protocolPrefix

export interface Entry extends Protocol {
  protocol: typeof protocol
}

export default protocol
