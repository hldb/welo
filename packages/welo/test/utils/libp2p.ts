import type { Helia } from '@helia/interface'
import type { Libp2p, ServiceMap } from '@libp2p/interface'

export const getTestLibp2p = async <T extends ServiceMap>(testIpfs: Helia<Libp2p<T>>): Promise<Libp2p<T>> => testIpfs.libp2p
