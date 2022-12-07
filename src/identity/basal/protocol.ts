import type { Protocol } from '~manifest/interface.js'

import protocolPrefix from '../prefix.js'

const type = 'basal'
const protocol: '/opal/identity/basal' = `${protocolPrefix}${type}`

export interface IdentityProtocol extends Protocol {
  protocol: typeof protocol
}

export default protocol
