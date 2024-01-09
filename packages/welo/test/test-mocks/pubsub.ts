import type { PubSub, PubSubEvents, PublishResult, TopicValidatorFn, Message, SignedMessage } from '@libp2p/interface/pubsub'
import type { Ed25519PeerId } from '@libp2p/interface/peer-id'
import { EventEmitter } from '@libp2p/interface/events'

class TestPubSub extends EventEmitter<PubSubEvents> implements PubSub {
  readonly globalSignaturePolicy: 'StrictSign' | 'StrictNoSign'
  readonly multicodecs: string[]
  readonly topicValidators: Map<string, TopicValidatorFn>

  constructor (
    readonly peerId: Ed25519PeerId,
    readonly mesh: Map<string, Set<Ed25519PeerId>>,
    readonly instances: Map<Ed25519PeerId, PubSub>
  ) {
    super()
    this.globalSignaturePolicy = 'StrictSign'
    this.multicodecs = []
    this.topicValidators = new Map()
  }

  getPeers (): Ed25519PeerId[] {
    const peers: Set<Ed25519PeerId> = new Set()
    for (const subscribers of this.mesh.values()) {
      if (subscribers.has(this.peerId)) subscribers.forEach(peers.add.bind(peers))
    }

    peers.delete(this.peerId)
    return [...peers]
  }

  getTopics (): string[] {
    const topics: string[] = []
    for (const [topic, subscribers] of this.mesh) {
      if (subscribers.has(this.peerId)) topics.push(topic)
    }
    return topics
  }

  subscribe (topic: string): void {
    const subscribers = this.mesh.get(topic)
    if (subscribers instanceof Set) {
      subscribers.add(this.peerId)
    } else {
      this.mesh.set(topic, new Set([this.peerId]))
    }
  }

  unsubscribe (topic: string): void {
    const subscribers = this.mesh.get(topic)
    if (subscribers instanceof Set) {
      subscribers.delete(this.peerId)
    }
  }

  getSubscribers (topic: string): Ed25519PeerId[] {
    const subscribers = this.mesh.get(topic) ?? new Set()

    return [...subscribers].filter(p => this.peerId !== p)
  }

  async publish (topic: string, data: Uint8Array): Promise<PublishResult> {
    const subscribers = new Set(this.getSubscribers(topic))
    const message: SignedMessage = {
      type: 'signed',
      from: this.peerId,
      topic,
      data,
      sequenceNumber: BigInt(0),
      signature: new Uint8Array(),
      key: new Uint8Array()
    }

    const event: CustomEvent<Message> = new CustomEvent<Message>('message', { detail: message })

    for (const [peerId, instance] of this.instances) {
      if (subscribers.has(peerId) && this.peerId !== peerId) {
        instance.dispatchEvent(event)
      }
    }

    return {
      recipients: this.getSubscribers(topic)
    }
  }
}

interface TestPubSubNetwork {
  createPubSubPeer: (peerId: Ed25519PeerId) => TestPubSub
}

export const getTestPubSubNetwork = (): TestPubSubNetwork => {
  const mesh: Map<string, Set<Ed25519PeerId>> = new Map()
  const instances: Map<Ed25519PeerId, PubSub> = new Map()

  return {
    createPubSubPeer (peerId: Ed25519PeerId) {
      return new TestPubSub(peerId, mesh, instances)
    }
  }
}
