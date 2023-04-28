import type { Multiaddr } from '@multiformats/multiaddr'
import { createHelia } from 'helia'
import type { Helia } from '@helia/interface'
import { isBrowser, isNode } from 'wherearewe'
import type { TestPaths } from './constants'
import { createLibp2p } from 'libp2p'
import { tcp } from '@libp2p/tcp'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { gossipsub } from '@chainsafe/libp2p-gossipsub'
import { MemoryDatastore } from 'datastore-core'
import { LevelDatastore } from 'datastore-level'
import { LevelBlockstore } from 'blockstore-level'

let swarmAddrs: string[]
if (isNode) {
  swarmAddrs = ['/ip4/127.0.0.1/tcp/0']
} else if (isBrowser) {
  swarmAddrs = ['/dns4/wrtc-star1.par.dwebops.pub/tcp/443/wss/p2p-webrtc-star/']
}

interface IpfsOptions {
  repo: string
  offline: boolean
}

export const offlineIpfsOptions = (repo: string): IpfsOptions => ({
  repo,
  offline: true
})

export const localIpfsOptions = (repo: string): IpfsOptions => ({
  repo,
  offline: false
})

type Opts = typeof offlineIpfsOptions | typeof localIpfsOptions

export const getTestIpfs = async (
  testPaths: TestPaths,
  opts: Opts
): Promise<Helia> => {
  const options = opts(testPaths.ipfs)
  const listen = options.offline ? [] : swarmAddrs
  const libp2p = await createLibp2p({
    addresses: {
      listen
    },
    transports: [
      tcp()
    ],
    connectionEncryption: [
      noise()
    ],
    streamMuxers: [
      yamux()
    ],
    pubsub: gossipsub(),
    nat: {
      enabled: false
    },
    datastore: new MemoryDatastore()
  })

  return await createHelia({
    datastore: new LevelDatastore(options.repo + '/data'),
    blockstore: new LevelBlockstore(options.repo + '/blocks'),
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
