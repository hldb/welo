import { strict as assert } from 'assert'
import EventEmitter from 'events'
import type { IPFS } from 'ipfs-core-types'
import type { Libp2p } from 'libp2p'
import type { PeerId } from '@libp2p/interface-peer-id'

import { Monitor } from '~pubsub/monitor.js'

import { getTestIpfs, localIpfsOptions } from './utils/ipfs.js'
import { getTestPaths, tempPath } from './utils/constants.js'
import { peerIdString } from '~utils/index.js'

const testName = 'pubsub/monitor'

describe(testName, () => {
  let
    ipfs1: IPFS,
    ipfs2: IPFS,
    libp2p1: Libp2p,
    libp2p2: Libp2p,
    id1: PeerId,
    id2: PeerId

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

    id1 = (await ipfs1.id()).id
    id2 = (await ipfs2.id()).id

    await Promise.all([
      ipfs1.swarm.connect(id2),
      ipfs2.swarm.connect(id1)
    ])
  })

  after(async () => {
    await Promise.all([ipfs1.stop(), ipfs2.stop()])
  })

  describe('instance', () => {
    it('exposes instance properties', () => {
      const topic = 'topic'
      const monitor = new Monitor(libp2p1, topic)
      assert.equal(monitor.libp2p, libp2p1)
      assert.equal(monitor.topic, topic)
      assert.deepEqual(monitor.peers, new Set())
      assert.ok(monitor instanceof Monitor)
      assert.ok(monitor instanceof EventEmitter)
    })

    describe('events', () => {
      let
        peer1: Monitor,
        peer2: Monitor

      let joins1 = 0
      let joins2 = 0
      let leaves1 = 0
      let leaves2 = 0
      let updates1 = 0
      let updates2 = 0

      before(() => {
        peer1 = new Monitor(libp2p1, sharedTopic)
        peer2 = new Monitor(libp2p2, sharedTopic)

        peer1.on('peer-join', () => joins1++)
        peer2.on('peer-join', () => joins2++)
        peer1.on('peer-leave', () => leaves1++)
        peer2.on('peer-leave', () => leaves2++)
        peer1.on('update', () => updates1++)
        peer2.on('update', () => updates2++)
      })

      it('emits peer-join when a peer joins', async () => {
        peer1.start()
        peer2.start()

        const promise = Promise.all([
          new Promise((resolve) => peer1.once('peer-join', resolve)),
          new Promise((resolve) => peer2.once('peer-join', resolve))
        ])

        assert.deepEqual(peer1.peers, new Set())
        assert.deepEqual(peer2.peers, new Set())

        const ids = await promise

        assert.deepEqual(ids[0], peerIdString(id2))
        assert.deepEqual(ids[1], peerIdString(id1))
        assert.equal(joins1, 1)
        assert.equal(joins2, 1)
        assert.equal(updates1, 1)
        assert.equal(updates2, 1)
      })

      it('emits peer-leave when a peer leaves', async () => {
        peer2.stop()
        await new Promise((resolve) => peer1.once('peer-leave', resolve))
        assert.equal(leaves1, 1)
        assert.equal(leaves2, 0)
        assert.equal(updates1, 2)
        assert.equal(updates2, 1)

        peer2.start()
        assert.deepEqual(peer2.peers, new Set([peerIdString(id1)]))
        await new Promise((resolve) => peer1.once('peer-join', resolve))
        assert.equal(joins1, 2)
        assert.equal(joins2, 1)
        assert.equal(updates1, 3)
        assert.equal(updates2, 1)

        peer1.stop()
        await new Promise((resolve) => peer2.once('peer-leave', resolve))
        assert.equal(leaves1, 1)
        assert.equal(leaves2, 1)
        assert.equal(updates1, 3)
        assert.equal(updates2, 2)

        peer2.stop()
      })
    })
  })
})
