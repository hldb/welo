import type { Protocol } from '../../manifest/interface.js'
import protocolPrefix from '../prefix.js'

const type = 'basal'
const protocol: '/opalsnt/entry/basal' = `${protocolPrefix}${type}`

export interface EntryProtocol extends Protocol {
  protocol: typeof protocol
}

export default protocol
