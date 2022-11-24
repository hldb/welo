import * as IPFS from 'ipfs-core'
import { IPFS as IPFSType } from 'ipfs-core-types'
import { TestPaths } from './constants'

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const offlineIpfsOptions = (repo: string) => ({
  repo,
  offline: true,
  config: {
    profile: 'test',
    Addresses: {
      Swarm: ['/ip4/127.0.0.1/tcp/0'],
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
      Swarm: ['/ip4/127.0.0.1/tcp/0'],
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
