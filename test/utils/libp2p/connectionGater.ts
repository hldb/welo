import type { Libp2pOptions } from 'libp2p'
import type { PeerId } from '@libp2p/interface-peer-id'

export const getBlockPeerConnectionGater = (neighbor: PeerId): Libp2pOptions['connectionGater'] => ({
  denyDialPeer: async () => false,
  denyDialMultiaddr: async () => false,
  denyInboundConnection: async () => false,
  denyOutboundConnection: async () => false,
  denyInboundEncryptedConnection: async () => false,
  denyOutboundEncryptedConnection: async () => false,
  denyInboundUpgradedConnection: async () => false,
  denyOutboundUpgradedConnection: async () => false,
  filterMultiaddrForPeer: async (peerId: PeerId) => !peerId.equals(neighbor)
})
