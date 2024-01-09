import { LevelBlockstore } from 'blockstore-level'
import { LevelDatastore } from 'datastore-level'
import { createHelia } from 'helia'
import { type Libp2pOptions, createLibp2p } from 'libp2p'
import { createLibp2pOptions } from './libp2p-options.js'
import type { TestPaths } from './constants'
import type { GossipHelia } from '@/interface.js'
import type { Multiaddr } from '@multiformats/multiaddr'

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

  const libp2pOptions = await createLibp2pOptions({
    datastore,
    ...libp2pOpts
  })

  const libp2p = await createLibp2p(libp2pOptions)

  return createHelia({
    datastore,
    blockstore,
    libp2p
  })
}

export const getMultiaddr = async (ipfs: GossipHelia): Promise<Multiaddr> => {
  const addresses = ipfs.libp2p.getMultiaddrs()
  if (addresses.length === 0) {
    throw new Error('no addresses available')
  }

  return addresses[0]
}
