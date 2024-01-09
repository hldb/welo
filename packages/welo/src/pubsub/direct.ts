import { EventEmitter, CustomEvent } from '@libp2p/interface/events'
import type {
  PubSub,
  Message,
  PublishResult,
  SubscriptionChangeData,
  SignedMessage
} from '@libp2p/interface/pubsub'
import type { PeerId } from '@libp2p/interface/peer-id'
import type { Startable } from '@libp2p/interface/startable'

import { peerIdString } from '@/utils/index.js'

import { getPeers, getTopics } from './util.js'

const prefix = '/dps/1.0.0/'

function sortAlphabetical (a: string, b: string): 1 | 0 | -1 {
  const nameA = a.toUpperCase() // ignore upper and lowercase
  const nameB = b.toUpperCase() // ignore upper and lowercase
  if (nameA < nameB) {
    return -1
  }

  if (nameA > nameB) {
    return 1
  }

  // names must be equal
  return 0
}

const channelTopic = (localPeerId: PeerId, remotePeerId: PeerId): string => {
  if (localPeerId === remotePeerId) {
    throw new Error('no direct channel with self')
  }

  const peerids = [peerIdString(localPeerId), peerIdString(remotePeerId)].sort(
    sortAlphabetical
  )

  return prefix + peerids.join('/')
}

export interface DirectEvents {
  peered: CustomEvent<undefined>
  unpeered: CustomEvent<undefined>
  message: CustomEvent<SignedMessage>
}

// The Direct Channel spec for the Live Replicator specifies that the channel is not unique per database
// This implementation makes it easier to handle messages per store while the pubsub channel is still shared

export class Direct extends EventEmitter<DirectEvents> implements Startable {
  readonly pubsub: PubSub
  readonly localPeerId: PeerId
  readonly remotePeerId: PeerId

  readonly #onSubscriptionChange: typeof onSubscriptionChange
  readonly #onMessage: typeof onMessage

  #isStarted: boolean

  isStarted (): boolean {
    return this.#isStarted
  }

  start (): void {
    if (!this.isStarted()) {
      this.pubsub.addEventListener(
        'subscription-change',
        this.#onSubscriptionChange
      )
      this.pubsub.addEventListener('message', this.#onMessage)
      this.pubsub.subscribe(this.topic)

      this.#isStarted = true
    }
  }

  stop (): void {
    if (this.isStarted()) {
      this.pubsub.unsubscribe(this.topic)

      this.pubsub.removeEventListener('message', this.#onMessage)
      this.pubsub.removeEventListener(
        'subscription-change',
        this.#onSubscriptionChange
      )

      this.#isStarted = false
    }
  }

  constructor (pubsub: PubSub, localPeerId: PeerId, remotePeerId: PeerId) {
    super()
    this.pubsub = pubsub
    this.localPeerId = localPeerId
    this.remotePeerId = remotePeerId

    this.#onSubscriptionChange = onSubscriptionChange.bind(this)
    this.#onMessage = onMessage.bind(this)

    this.#isStarted = false
  }

  get topic (): string {
    return channelTopic(this.localPeerId, this.remotePeerId)
  }

  isOpen (): boolean {
    return (
      getPeers(this.pubsub, this.topic).filter(
        this.remotePeerId.equals.bind(this.remotePeerId)
      ).length !== 0 && getTopics(this.pubsub).includes(this.topic)
    )
  }

  async publish (bytes: Uint8Array): Promise<PublishResult> {
    if (!this.isOpen()) {
      throw new Error('direct pubsub not open')
    }

    return await this.pubsub.publish(this.topic, bytes)
  }
}

function onMessage (this: Direct, evt: CustomEvent<Message>): void {
  const message = evt.detail
  if (message.type === 'unsigned') {
    return
  }

  if (!message.from.equals(this.remotePeerId)) {
    return
  }

  this.dispatchEvent(
    new CustomEvent<SignedMessage>('message', { detail: message })
  )
}

function onSubscriptionChange (
  this: Direct,
  evt: CustomEvent<SubscriptionChangeData>
): void {
  const { peerId, subscriptions } = evt.detail

  if (!peerId.equals(this.remotePeerId)) {
    return
  }

  for (const { topic, subscribe } of subscriptions) {
    if (topic === this.topic) {
      if (subscribe) {
        this.dispatchEvent(new CustomEvent<undefined>('peered'))
      } else {
        this.dispatchEvent(new CustomEvent<undefined>('unpeered'))
      }
    }
  }
}
