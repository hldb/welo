import { Protocol } from '../../manifest/interface.js'
import protocolPrefix from '../prefix.js'

const protocol = protocolPrefix

export interface Config {
  write: Array<string | Uint8Array>
}

export interface AccessProtocol extends Protocol {
  protocol: typeof protocol
  config: Config
}

export default protocol
