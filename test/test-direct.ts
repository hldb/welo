import { strict as assert } from 'assert'
import EventEmitter from 'events'
import { stop } from '@libp2p/interfaces/startable'
import type { IPFS } from 'ipfs-core-types'
import type { Libp2p } from 'libp2p'
import type { PeerId } from '@libp2p/interface-peer-id'
import type { Message } from '@libp2p/interface-pubsub'

import { Direct } from '~pubsub/direct.js'

import { getTestIpfs, localIpfsOptions } from './utils/ipfs.js'
import { getTestPaths, tempPath } from './utils/constants.js'

const testName = 'pubsub peer monitor'

describe(testName, () => {
  let
    ipfs1: IPFS,
    ipfs2: IPFS,
    ipfs3: IPFS,
    libp2p1: Libp2p,
    libp2p2: Libp2p,
    libp2p3: Libp2p,
    id1: PeerId,
    id2: PeerId,
    id3: PeerId

  const prefix = '/dps/1.0.0/'

  before(async () => {
    const testPaths1 = getTestPaths(tempPath, testName + '/1')
    const testPaths2 = getTestPaths(tempPath, testName + '/2')
    const testPaths3 = getTestPaths(tempPath, testName + '/3')

    ipfs1 = await getTestIpfs(testPaths1, localIpfsOptions)
    ipfs2 = await getTestIpfs(testPaths2, localIpfsOptions)
    ipfs3 = await getTestIpfs(testPaths3, localIpfsOptions)
    // @ts-expect-error
    libp2p1 = ipfs1.libp2p as Libp2p
    // @ts-expect-error
    libp2p2 = ipfs2.libp2p as Libp2p
    // @ts-expect-error
    libp2p3 = ipfs3.libp2p as Libp2p

    id1 = (await ipfs1.id()).id
    id2 = (await ipfs2.id()).id
    id3 = (await ipfs3.id()).id

    await Promise.all([
      ipfs1.swarm.connect(id2),
      ipfs1.swarm.connect(id3),
      ipfs2.swarm.connect(id1),
      ipfs2.swarm.connect(id3),
      ipfs3.swarm.connect(id1),
      ipfs3.swarm.connect(id2)
    ])
  })

  after(async () => {
    await stop(
      ipfs1,
      ipfs2,
      ipfs3
    )
  })

  describe('instance', () => {
    it('exposes instance properties', () => {
      const direct = new Direct(libp2p1, id2)
      assert.equal(direct.libp2p, libp2p1)
      assert.ok(direct.topic.startsWith(prefix))
      assert.ok(direct.isOpen)
      assert.ok(direct instanceof EventEmitter)
    })

    describe('events', () => {
      let
        peer1: Direct,
        peer2: Direct,
        topic: string

      const messages1: Array<CustomEvent<Message>> = []
      const messages2: Array<CustomEvent<Message>> = []
      const messages3: Array<CustomEvent<Message>> = []

      const onMessage1 = messages1.push.bind(messages1)
      const onMessage2 = messages2.push.bind(messages2)
      const onMessage3 = messages3.push.bind(messages3)

      before(() => {
        peer1 = new Direct(libp2p1, id2)
        peer2 = new Direct(libp2p2, id1)
        topic = peer1.topic

        peer1.on('message', onMessage1)
        peer2.on('message', onMessage2)
        libp2p3.pubsub.addEventListener('message', onMessage3)
      })

      it('emits peered when pubsub peered with remote peer', async () => {
        peer1.start()
        peer2.start()
        libp2p3.pubsub.subscribe(topic)

        const promise = Promise.all([
          new Promise((resolve) => peer1.once('peered', resolve)),
          new Promise((resolve) => peer2.once('peered', resolve))
        ])

        assert.equal(peer1.isOpen(), false)
        assert.equal(peer2.isOpen(), false)

        await promise

        assert.equal(peer1.isOpen(), true)
        assert.equal(peer2.isOpen(), true)
      })

      it('emits message when receiving messages from remote peer', async () => {
        void peer1.publish(new Uint8Array([1]))
        void peer2.publish(new Uint8Array([2]))
        void libp2p3.pubsub.publish(topic, new Uint8Array([3]))
        void await Promise.all([
          new Promise((resolve) => peer1.once('message', resolve)),
          new Promise((resolve) => peer2.once('message', resolve)),
          new Promise((resolve) => libp2p3.pubsub.addEventListener('message', () => messages3.length === 2 && resolve(true)))
        ])

        assert.equal(messages1.length, 1)
        assert.equal(messages2.length, 1)
        assert.equal(messages3.length, 2)

        peer1.removeListener('message', onMessage1)
        peer2.removeListener('message', onMessage2)
        libp2p3.pubsub.removeEventListener('message', onMessage3)
      })

      it('emits unpeered when remote peer is no longer pubsub peered', async () => {
        assert.equal(peer1.isOpen(), true)
        assert.equal(peer2.isOpen(), true)

        await Promise.all([
          new Promise((resolve) => peer2.once('unpeered', resolve)),
          peer1.stop()
        ])

        assert.equal(peer1.isOpen(), false)
        assert.equal(peer2.isOpen(), false)

        await Promise.all([
          new Promise((resolve) => peer2.once('peered', resolve)),
          peer1.start()
        ])

        assert.equal(peer1.isOpen(), true)
        assert.equal(peer2.isOpen(), true)

        peer2.stop()
        peer2.stop()
        libp2p3.pubsub.unsubscribe(topic)
      })
    })
  })
})
