import type { Multiaddr } from '@multiformats/multiaddr'
import { createHelia } from 'helia'
import type { Helia } from '@helia/interface'
import type { TestPaths } from './constants'
import { Libp2pOptions, createLibp2p } from 'libp2p'
import { LevelDatastore } from 'datastore-level'
import { LevelBlockstore } from 'blockstore-level'
import { bootstrap } from '@libp2p/bootstrap'
import { getAddrs } from './circuit-relay.js'

import type { GossipHelia } from '@/interface.js'
import { createLibp2pOptions } from './libp2p-options.js'

interface IpfsOptions {
  repo: string
}

export const offlineIpfsOptions = (repo: string): IpfsOptions => ({
  repo
})

export const localIpfsOptions = (repo: string): IpfsOptions => ({
  repo
})

type Opts = typeof offlineIpfsOptions | typeof localIpfsOptions

export const getTestIpfs = async (
  testPaths: TestPaths,
  opts: Opts,
  libp2pOpts: Libp2pOptions = {}
): Promise<GossipHelia> => {
  const options = opts(testPaths.ipfs)

  const datastore = new LevelDatastore(options.repo + '/data')
  const blockstore = new LevelBlockstore(options.repo + '/blocks')

  const libp2pOptions = createLibp2pOptions({
    datastore,
    peerDiscovery: [
      bootstrap({ list: (await getAddrs()).map(String) })
    ],
    ...libp2pOpts
  })

  const libp2p = await createLibp2p(libp2pOptions)

  return await createHelia({
    datastore,
    blockstore,
    libp2p
  })
}

export const getMultiaddr = async (ipfs: Helia): Promise<Multiaddr> => {
  const addresses = ipfs.libp2p.getMultiaddrs()
  if (addresses.length === 0) {
    throw new Error('no addresses available')
  }

  return addresses[0]
}
