import { strict as assert } from 'assert'
import EventEmitter from 'events'
import type { IPFS } from 'ipfs-core-types'
import type { Libp2p } from 'libp2p'
import type { PubSub } from '@libp2p/interface-pubsub'

import { Monitor } from '~pubsub/monitor.js'

import { getTestIpfs, localIpfsOptions } from './utils/ipfs.js'
import { getTestPaths, tempPath } from './utils/constants.js'

const testName = 'pubsub peer monitor'

describe(testName, () => {
  let
    ipfs1: IPFS,
    ipfs2: IPFS,
    libp2p1: Libp2p,
    libp2p2: Libp2p,
    id1: string,
    id2: string,
    pubsub1: PubSub,
    pubsub2: PubSub

  const sharedTopic = 'shared-topic'

  before(async () => {
    const testPaths1 = getTestPaths(tempPath, testName + '/1')
    const testPaths2 = getTestPaths(tempPath, testName + '/2')

    ipfs1 = await getTestIpfs(testPaths1, localIpfsOptions)
    ipfs2 = await getTestIpfs(testPaths2, localIpfsOptions)
    // @ts-expect-error
    libp2p1 = ipfs1.libp2p as Libp2p
    // @ts-expect-error
    libp2p2 = ipfs2.libp2p as Libp2p

    id1 = (await ipfs1.id()).id.toString()
    id2 = (await ipfs2.id()).id.toString()
  })

  after(async () => {
    await Promise.all([ipfs1.stop(), ipfs2.stop()])
  })

  describe('instance', () => {
    it('exposes instance properties', () => {
      const monitor = new Monitor(libp2p1, 'topic')
      assert.ok(monitor.libp2p)
      assert.ok(monitor.topic)
      assert.ok(monitor.peers)
      assert.ok(monitor instanceof Monitor)
      assert.ok(monitor instanceof EventEmitter)
    })

    describe('peers', () => {
      it('returns a set of peerId strings for current peers', () => {
        const monitor = new Monitor(libp2p1, 'topic')
        assert.deepEqual(monitor.peers, new Set())
      })
    })

    describe('peers-join', () => {
      it('emitted when a peer joins', async () => {
        const peer1 = new Monitor(libp2p1, sharedTopic)
        const peer2 = new Monitor(libp2p2, sharedTopic)

        let joins1 = 0
        let joins2 = 0

        peer1.on('peer-join', () => joins1++)
        peer2.on('peer-join', () => joins2++)

        peer1.start()
        peer2.start()

        const promise = Promise.all([
          new Promise((resolve) => peer1.once('join', resolve)),
          new Promise((resolve) => peer2.once('join', resolve))
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

    describe('peers-leave', () => {
      it('emitted when a peer leaves', () => {})
    })

    describe('update', () => {
      it('emitted when peers-join is emitted', () => {})

      it('emitted when peers-join is emitted', () => {})
    })
  })
})
