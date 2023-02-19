import type { Multiaddr } from '@multiformats/multiaddr'
import * as IPFS from 'ipfs-core'
import type { IPFS as IPFSType } from 'ipfs-core-types'
import { isBrowser, isNode } from 'wherearewe'
import type { TestPaths } from './constants'

let swarmAddrs: string[]
if (isNode) {
  swarmAddrs = ['/ip4/127.0.0.1/tcp/0']
} else if (isBrowser) {
  swarmAddrs = ['/dns4/wrtc-star1.par.dwebops.pub/tcp/443/wss/p2p-webrtc-star/']
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const offlineIpfsOptions = (repo: string) => ({
  repo,
  offline: true,
  config: {
    profile: 'test',
    Addresses: {
      Swarm: [],
      Announce: [],
      NoAnnounce: [],
      Delegates: []
    },
    Bootstrap: [],
    Pubsub: {
      Router: 'gossipsub',
      Enabled: true
    }
  }
})

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const localIpfsOptions = (repo: string) => ({
  repo,
  config: {
    Addresses: {
      Swarm: swarmAddrs,
      Announce: [],
      NoAnnounce: [],
      Delegates: []
    },
    Bootstrap: [],
    Pubsub: {
      Router: 'gossipsub',
      Enabled: true
    }
  }
})

type Opts = typeof offlineIpfsOptions | typeof localIpfsOptions

export const getTestIpfs = async (
  testPaths: TestPaths,
  opts: Opts
): Promise<IPFSType> => {
  return (await IPFS.create(opts(testPaths.ipfs))) as unknown as IPFSType
}

export const getMultiaddr = async (ipfs: IPFSType): Promise<Multiaddr> => {
  const { addresses } = await ipfs.id()
  if (addresses.length === 0) {
    throw new Error('no addresses available')
  }

  return addresses[0]
}
