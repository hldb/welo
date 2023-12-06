import type { PeerId } from '@libp2p/interface/peer-id'
import type { PubSub } from '@libp2p/interface/pubsub'

export const getPeers = (pubsub: PubSub, topic: string): PeerId[] =>
  pubsub.getSubscribers(topic)

export const getTopics = (pubsub: PubSub): string[] => pubsub.getTopics()
