import type { IPFS } from 'ipfs-core-types'
import type { Libp2p } from 'libp2p'

export const getTestLibp2p = async (testIpfs: IPFS): Promise<Libp2p> =>
  // @ts-expect-error
  testIpfs.libp2p as Libp2p
