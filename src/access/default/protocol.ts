import { Protocol } from '../../manifest/interface'
import protocolPrefix from '../prefix'

const protocol = protocolPrefix

export interface Config {
  write: Array<string | Uint8Array>
}

export interface Access extends Protocol {
  protocol: typeof protocol
  config: Config
}

export default protocol
