/* eslint-disable max-nested-callbacks */
import { assert } from 'aegir/chai'
import { EventEmitter } from '@libp2p/interface/events'
import type { PeerId } from '@libp2p/interface/peer-id'

import { Monitor } from '@/pubsub/monitor.js'
import { peerIdString } from '@/utils/index.js'

import type { PubSub } from '@libp2p/interface/dist/src/pubsub/index.js'
import { getTestPubSubNetwork } from '../test-mocks/pubsub'
import { createEd25519PeerId } from '@libp2p/peer-id-factory'

const testName = 'pubsub/monitor'

describe(testName, () => {
  let
    pubsub1: PubSub,
    pubsub2: PubSub,
    id1: PeerId,
    id2: PeerId

  const sharedTopic = 'shared-topic'

  before(async () => {
    id1 = await createEd25519PeerId()
    id2 = await createEd25519PeerId()

    const { createPubSubPeer } = getTestPubSubNetwork()
    pubsub1 = createPubSubPeer(id1)
    pubsub2 = createPubSubPeer(id2)
  })

  describe('instance', () => {
    it('exposes instance properties', () => {
      const topic = 'topic'
      const monitor = new Monitor(pubsub1, topic)
      assert.strictEqual(monitor.topic, topic)
      assert.deepEqual(monitor.peers, new Set())
      assert.isOk(monitor instanceof Monitor)
      assert.isOk(monitor instanceof EventEmitter)
    })

    describe('events', () => {
      let peer1: Monitor, peer2: Monitor

      let joins1 = 0
      let joins2 = 0
      let leaves1 = 0
      let leaves2 = 0
      let updates1 = 0
      let updates2 = 0

      before(() => {
        peer1 = new Monitor(pubsub1, sharedTopic)
        peer2 = new Monitor(pubsub2, sharedTopic)

        peer1.addEventListener('peer-join', () => joins1++)
        peer2.addEventListener('peer-join', () => joins2++)
        peer1.addEventListener('peer-leave', () => leaves1++)
        peer2.addEventListener('peer-leave', () => leaves2++)
        peer1.addEventListener('update', () => updates1++)
        peer2.addEventListener('update', () => updates2++)
      })

      it('emits peer-join when a peer joins', async () => {
        peer1.start()
        peer2.start()

        const promise = Promise.all([
          new Promise((resolve) => { peer1.addEventListener('peer-join', resolve, { once: true }) }
          ),
          new Promise((resolve) => { peer2.addEventListener('peer-join', resolve, { once: true }) }
          )
        ])

        assert.deepEqual(peer1.peers, new Set())
        assert.deepEqual(peer2.peers, new Set())

        await promise

        assert.strictEqual(peer1.peers.has(peerIdString(id2)), true)
        assert.strictEqual(peer2.peers.has(peerIdString(id1)), true)
        assert.strictEqual(joins1, 1)
        assert.strictEqual(joins2, 1)
        assert.strictEqual(updates1, 1)
        assert.strictEqual(updates2, 1)
      })

      it('emits peer-leave when a peer leaves', async () => {
        peer2.stop()
        await new Promise((resolve) => { peer1.addEventListener('peer-leave', resolve, { once: true }) }
        )
        assert.strictEqual(leaves1, 1)
        assert.strictEqual(leaves2, 0)
        assert.strictEqual(updates1, 2)
        assert.strictEqual(updates2, 1)

        peer2.start()
        assert.deepEqual(peer2.peers, new Set([peerIdString(id1)]))
        await new Promise((resolve) => { peer1.addEventListener('peer-join', resolve, { once: true }) }
        )
        assert.strictEqual(joins1, 2)
        assert.strictEqual(joins2, 1)
        assert.strictEqual(updates1, 3)
        assert.strictEqual(updates2, 1)

        peer1.stop()
        await new Promise((resolve) => { peer2.addEventListener('peer-leave', resolve, { once: true }) }
        )
        assert.strictEqual(leaves1, 1)
        assert.strictEqual(leaves2, 1)
        assert.strictEqual(updates1, 3)
        assert.strictEqual(updates2, 2)

        peer2.stop()
      })
    })
  })
})
