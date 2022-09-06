const offlineIpfsOptions = (repo: string) => ({
  repo,
  offline: true,
  config: {
    profile: "test",
    Addresses: {
      Swarm: [],
      Announce: [],
      NoAnnounce: [],
      Delegates: [],
    },
    Bootstrap: [],
    Pubsub: {
      Router: "gossipsub",
      Enabled: true,
    },
  },
});

export const ipfs = {
  offline: offlineIpfsOptions,
};
