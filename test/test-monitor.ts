/* eslint-disable max-nested-callbacks */
import { assert } from 'aegir/chai'
import { EventEmitter } from '@libp2p/interfaces/events'
import { stop } from '@libp2p/interfaces/startable'
import type { PeerId } from '@libp2p/interface-peer-id'

import { Monitor } from '@/pubsub/monitor.js'
import { peerIdString } from '@/utils/index.js'

import type { Multiaddr } from '@multiformats/multiaddr'
import { Libp2p, Libp2pOptions, createLibp2p } from 'libp2p'
import { getIdentifyService, getPubsubService, type UsedServices } from './utils/libp2p/services.js'
import { getLibp2pDefaults } from './utils/libp2p/defaults.js'
import type { Helia } from '@helia/interface'
import { createHelia } from 'helia'

const testName = 'pubsub/monitor'

type TestServices = UsedServices<'identify' | 'pubsub'>

describe(testName, () => {
  let
    helia1: Helia<Libp2p<TestServices>>,
    helia2: Helia<Libp2p<TestServices>>,
    libp2p1: Libp2p<TestServices>,
    libp2p2: Libp2p<TestServices>,
    id1: PeerId,
    id2: PeerId,
    addr2: Multiaddr[]

  const sharedTopic = 'shared-topic'

  before(async () => {
    const createLibp2pOptions = async (): Promise<Libp2pOptions<TestServices>> => ({
      ...(await getLibp2pDefaults()),
      services: {
        identify: getIdentifyService(),
        pubsub: getPubsubService()
      }
    })

    libp2p1 = await createLibp2p(await createLibp2pOptions())
    libp2p2 = await createLibp2p(await createLibp2pOptions())

    helia1 = await createHelia({ libp2p: libp2p1 })
    helia2 = await createHelia({ libp2p: libp2p2 })

    id1 = libp2p1.peerId
    id2 = libp2p2.peerId

    addr2 = libp2p2.getMultiaddrs()

    await libp2p1.dial(addr2)
  })

  after(async () => {
    await stop(helia1)
    await stop(helia2)
  })

  describe('instance', () => {
    it('exposes instance properties', () => {
      const topic = 'topic'
      const monitor = new Monitor(libp2p1, topic)
      assert.strictEqual(monitor.libp2p, libp2p1)
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
        peer1 = new Monitor(libp2p1, sharedTopic)
        peer2 = new Monitor(libp2p2, sharedTopic)

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
