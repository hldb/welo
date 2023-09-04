/* eslint-disable no-console */
import { assert } from 'aegir/chai'
import { EventEmitter } from '@libp2p/interface/events'
import type { PeerId } from '@libp2p/interface/peer-id'
import type { Message, PubSub } from '@libp2p/interface/pubsub'

import { Direct } from '@/pubsub/direct.js'

import { createEd25519PeerId } from '@libp2p/peer-id-factory'
import { getTestPubSubNetwork } from 'test/test-mocks/pubsub.js'

const testName = 'pubsub/direct'

describe(testName, () => {
  let
    pubsub1: PubSub,
    pubsub2: PubSub,
    pubsub3: PubSub,
    id1: PeerId,
    id2: PeerId,
    id3: PeerId

  const prefix = '/dps/1.0.0/'

  before(async () => {
    id1 = await createEd25519PeerId()
    id2 = await createEd25519PeerId()
    id3 = await createEd25519PeerId()

    const { createPubSubPeer } = getTestPubSubNetwork()
    pubsub1 = createPubSubPeer(id1)
    pubsub2 = createPubSubPeer(id2)
    pubsub3 = createPubSubPeer(id3)
  })

  describe('instance', () => {
    it('exposes instance properties', () => {
      const direct = new Direct(pubsub1, id1, id2)
      assert.isOk(direct.topic.startsWith(prefix))
      assert.isOk(direct.isOpen)
      assert.isOk(direct instanceof EventEmitter)
    })

    describe('events', () => {
      let peer1: Direct, peer2: Direct, topic: string

      const messages1: Array<CustomEvent<Message>> = []
      const messages2: Array<CustomEvent<Message>> = []
      const messages3: Array<CustomEvent<Message>> = []

      const onMessage1 = messages1.push.bind(messages1)
      const onMessage2 = messages2.push.bind(messages2)
      const onMessage3 = messages3.push.bind(messages3)

      before(() => {
        peer1 = new Direct(pubsub1, id1, id2)
        peer2 = new Direct(pubsub2, id2, id1)
        topic = peer1.topic

        peer1.addEventListener('message', onMessage1)
        peer2.addEventListener('message', onMessage2)
        pubsub3.addEventListener('message', onMessage3)
      })

      it('emits peered when pubsub peered with remote peer', async () => {
        peer1.start()
        peer2.start()
        pubsub3.subscribe(topic)

        let listener1, listener2, listener3
        const promise = Promise.all([
          new Promise((resolve) => { peer1.addEventListener('peered', resolve, { once: true }) }
          ),
          new Promise((resolve) => { peer2.addEventListener('peered', resolve, { once: true }) }
          ),
          new Promise<void>((resolve) => {
            let i: number = 0
            listener1 = () => { !Number.isNaN(i++) && i === 2 && resolve() }
            pubsub1.addEventListener('subscription-change', listener1)
          }),
          new Promise<void>((resolve) => {
            let i: number = 0
            listener2 = () => { !Number.isNaN(i++) && i === 2 && resolve() }
            pubsub2.addEventListener('subscription-change', listener2)
          }),
          new Promise<void>((resolve) => {
            let i: number = 0
            listener3 = () => { !Number.isNaN(i++) && i === 2 && resolve() }
            pubsub3.addEventListener('subscription-change', listener3)
          })
        ])

        assert.strictEqual(peer1.isOpen(), false)
        assert.strictEqual(peer2.isOpen(), false)

        await promise

        assert.strictEqual(peer1.isOpen(), true)
        assert.strictEqual(peer2.isOpen(), true)
      })

      it('emits message when receiving messages from remote peer', async () => {
        let listener
        const promise = Promise.all([
          new Promise((resolve) => { peer1.addEventListener('message', resolve, { once: true }) }
          ),
          new Promise((resolve) => { peer2.addEventListener('message', resolve, { once: true }) }
          ),
          new Promise((resolve) => {
            listener = (): void => {
              messages3.length === 3 && resolve(true)
            }
            pubsub3.addEventListener('message', listener)
          })
        ])
        void (await Promise.all([
          peer1.publish(new Uint8Array([1])),
          peer2.publish(new Uint8Array([2])),
          pubsub3.publish(topic, new Uint8Array([3]))
        ]))

        await promise
        pubsub1.removeEventListener('message', listener)

        assert.strictEqual(messages1.length, 1)
        assert.strictEqual(messages2.length, 1)
        assert.strictEqual(messages3.length, 3)

        peer1.removeEventListener('message', onMessage1)
        peer2.removeEventListener('message', onMessage2)
        pubsub3.removeEventListener('message', onMessage3)
      })

      it('emits unpeered when remote peer is no longer pubsub peered', async () => {
        assert.strictEqual(peer1.isOpen(), true)
        assert.strictEqual(peer2.isOpen(), true)

        await Promise.all([
          new Promise((resolve) => { peer2.addEventListener('unpeered', resolve, { once: true }) }
          ),
          // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
          peer1.stop()
        ])

        assert.strictEqual(peer1.isOpen(), false)
        assert.strictEqual(peer2.isOpen(), false)

        await Promise.all([
          new Promise((resolve) => { peer2.addEventListener('peered', resolve, { once: true }) }
          ),
          // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
          peer1.start()
        ])

        assert.strictEqual(peer1.isOpen(), true)
        assert.strictEqual(peer2.isOpen(), true)

        peer1.stop()
        peer2.stop()
        pubsub3.unsubscribe(topic)
      })
    })
  })
})
