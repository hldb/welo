import type { Helia } from '@helia/interface'
import type { Libp2p } from 'libp2p'

export const getTestLibp2p = async (testIpfs: Helia): Promise<Libp2p> => testIpfs.libp2p
