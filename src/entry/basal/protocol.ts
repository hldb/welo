import type { Protocol } from '../../manifest/interface.js'
import { prefix } from '../interface.js'

const protocol  = `${prefix}basal` as const

export interface EntryProtocol extends Protocol {
  protocol: typeof protocol
}

export default protocol
