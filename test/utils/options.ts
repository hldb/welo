// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const offlineIpfsOptions = (repo: string) => ({
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
const localIpfsOptions = (repo: string) => ({
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

export const ipfs = {
  offline: offlineIpfsOptions,
  local: localIpfsOptions
}
