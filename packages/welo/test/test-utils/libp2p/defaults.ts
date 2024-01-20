import type { Libp2pOptions } from 'libp2p'
import { addresses } from './addresses.js'
import { getTransports } from './transports.js'
import { getStreamMuxers } from './streamMuxers.js'
import { getConnectionEncryption } from './connectionEncryption.js'
import { getAllowAllConnectionGater } from './connectionGater.js'

export const getLibp2pDefaults = async (): Promise<Libp2pOptions<{}>> => ({
  addresses,
  transports: getTransports(),
  connectionEncryption: getConnectionEncryption(),
  streamMuxers: getStreamMuxers(),
  connectionGater: getAllowAllConnectionGater()
})