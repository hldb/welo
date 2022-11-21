import { strict as assert } from 'assert'
import { IPFS } from 'ipfs-core-types'
import type { PubSub } from '@libp2p/interface-pubsub'

import { Monitor } from '~pubsub/monitor.js'

import { getIpfs } from './utils/index.js'
import { ipfs } from './utils/options.js'

const sharedTopic = 'shared-topic'

describe('PubSub Peer Monitor', () => {
  let
    ipfs1: IPFS,
    ipfs2: IPFS,
    id1: string,
    id2: string,
    pubsub1: PubSub,
    pubsub2: PubSub

  before(async () => {
    ipfs1 = await getIpfs(ipfs.local)
    ipfs2 = await getIpfs()
    id1 = (await ipfs1.id()).id.toString()
    id2 = (await ipfs2.id()).id.toString()
    pubsub1 = ipfs1.pubsub
    pubsub2 = ipfs2.pubsub
  })

  after(async () => {
    await Promise.all([
      ipfs1.stop(),
      ipfs2.stop()
    ])
  })

  describe('instance', () => {
    it('exposes instance properties', () => {
      const monitor = new Monitor(pubsub1, 'topic')
      assert.ok(monitor.pubsub)
      assert.ok(monitor.topic)
      assert.ok(monitor.peers)
      assert.ok(monitor.events)
    })

    describe('peers', () => {
      it('returns a set of peerId strings for current peers', () => {
        const monitor = new Monitor(pubsub1, 'topic')
        assert.deepEqual(monitor.peers(), new Set())
      })
    })

    describe('peer-join', () => {
      it('emitted when a peer joins', async () => {
        const peer1 = new Monitor(pubsub1, sharedTopic)
        const peer2 = new Monitor(pubsub2, sharedTopic)

        let joins1 = 0
        let joins2 = 0

        peer1.events.on('peer-join', () => joins1++)
        peer2.events.on('peer-join', () => joins2++)

        peer1.start()
        peer2.start()

        const promise = Promise.all([
          new Promise(resolve => peer1.events.once('join', resolve)),
          new Promise(resolve => peer2.events.once('join', resolve))
        ])

        pubsub1.subscribe(sharedTopic)
        pubsub2.subscribe(sharedTopic)

        assert.deepEqual(peer1.peers, new Set())
        assert.deepEqual(peer2.peers, new Set())

        const ids = await promise

        assert.equal(ids[0], id2)
        assert.equal(ids[1], id1)
        assert.equal(joins1, 1)
        assert.equal(joins2, 1)
      })
    })

    describe('peer-leave', () => {
      it('emitted when a peer leaves', () => {

      })
    })

    describe('update', () => {
      it('emitted when peer-join is emitted', () => {

      })

      it('emitted when peer-join is emitted', () => {

      })
    })
  })
})
