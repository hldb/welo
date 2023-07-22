import { assert } from 'aegir/chai'
import { EventEmitter } from '@libp2p/interfaces/events'
import { stop } from '@libp2p/interfaces/startable'
import type { PeerId } from '@libp2p/interface-peer-id'
import type { Message } from '@libp2p/interface-pubsub'
import type { Multiaddr } from '@multiformats/multiaddr'

import { Direct } from '@/pubsub/direct.js'

import { getLibp2pDefaults } from './utils/libp2p/defaults.js'
import { UsedServices, getIdentifyService, getPubsubService } from './utils/libp2p/services.js'
import { Libp2p, Libp2pOptions, createLibp2p } from 'libp2p'
import type { Helia } from '@helia/interface'
import { getPeerDiscovery } from './utils/libp2p/peerDiscovery.js'
import { createHelia } from 'helia'

const testName = 'pubsub/direct'

// can be removed after type changes to welo
type TestServices = UsedServices<'identify' | 'pubsub'>

describe(testName, () => {
  let
    helia1: Helia<Libp2p<TestServices>>,
    helia2: Helia<Libp2p<TestServices>>,
    helia3: Helia<Libp2p<TestServices>>,
    libp2p1: Libp2p<TestServices>,
    libp2p2: Libp2p<TestServices>,
    libp2p3: Libp2p<TestServices>,
    id1: PeerId,
    id2: PeerId,
    // id3: PeerId,
    addr1: Multiaddr[],
    addr2: Multiaddr[],
    addr3: Multiaddr[]

  const prefix = '/dps/1.0.0/'

  before(async () => {
    const createLibp2pOptions = async (): Promise<Libp2pOptions<TestServices>> => ({
      ...(await getLibp2pDefaults()),
      peerDiscovery: await getPeerDiscovery(),
      services: {
        identify: getIdentifyService(),
        pubsub: getPubsubService()
      }
    })

    libp2p1 = await createLibp2p(await createLibp2pOptions())
    libp2p2 = await createLibp2p(await createLibp2pOptions())
    libp2p3 = await createLibp2p(await createLibp2pOptions())
    helia1 = await createHelia({ libp2p: libp2p1 })
    helia2 = await createHelia({ libp2p: libp2p2 })
    helia3 = await createHelia({ libp2p: libp2p3 })

    id1 = libp2p1.peerId
    id2 = libp2p2.peerId

    addr1 = libp2p1.getMultiaddrs()
    addr2 = libp2p2.getMultiaddrs()
    addr3 = libp2p3.getMultiaddrs()

    await Promise.all([
      libp2p1.dial(addr2),
      libp2p2.dial(addr3),
      libp2p3.dial(addr1)
    ])
  })

  after(async () => {
    await stop(helia1)
    await stop(helia2)
    await stop(helia3)
  })

  describe('instance', () => {
    it('exposes instance properties', () => {
      const direct = new Direct(libp2p1, id2)
      assert.strictEqual(direct.libp2p, libp2p1)
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
        peer1 = new Direct(libp2p1, id2)
        peer2 = new Direct(libp2p2, id1)
        topic = peer1.topic

        peer1.addEventListener('message', onMessage1)
        peer2.addEventListener('message', onMessage2)
        libp2p3.services.pubsub.addEventListener('message', onMessage3)
      })

      it('emits peered when pubsub peered with remote peer', async () => {
        peer1.start()
        peer2.start()
        libp2p3.services.pubsub.subscribe(topic)

        let listener1, listener2, listener3
        const promise = Promise.all([
          new Promise((resolve) => { peer1.addEventListener('peered', resolve, { once: true }) }
          ),
          new Promise((resolve) => { peer2.addEventListener('peered', resolve, { once: true }) }
          ),
          new Promise<void>((resolve) => {
            let i: number = 0
            listener1 = () => { !Number.isNaN(i++) && i === 2 && resolve() }
            libp2p1.services.pubsub.addEventListener('subscription-change', listener1)
          }),
          new Promise<void>((resolve) => {
            let i: number = 0
            listener2 = () => { !Number.isNaN(i++) && i === 2 && resolve() }
            libp2p2.services.pubsub.addEventListener('subscription-change', listener2)
          }),
          new Promise<void>((resolve) => {
            let i: number = 0
            listener3 = () => { !Number.isNaN(i++) && i === 2 && resolve() }
            libp2p3.services.pubsub.addEventListener('subscription-change', listener3)
          })
        ])

        assert.strictEqual(peer1.isOpen(), false)
        assert.strictEqual(peer2.isOpen(), false)

        await promise
        libp2p1.services.pubsub.removeEventListener('subscription-change', listener1)
        libp2p2.services.pubsub.removeEventListener('subscription-change', listener2)
        libp2p3.services.pubsub.removeEventListener('subscription-change', listener3)

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
            libp2p3.services.pubsub.addEventListener('message', listener)
          })
        ])
        void (await Promise.all([
          peer1.publish(new Uint8Array([1])),
          peer2.publish(new Uint8Array([2])),
          libp2p3.services.pubsub.publish(topic, new Uint8Array([3]))
        ]))

        await promise
        libp2p1.services.pubsub.removeEventListener('message', listener)

        assert.strictEqual(messages1.length, 1)
        assert.strictEqual(messages2.length, 1)
        assert.strictEqual(messages3.length, 3)

        peer1.removeEventListener('message', onMessage1)
        peer2.removeEventListener('message', onMessage2)
        libp2p3.services.pubsub.removeEventListener('message', onMessage3)
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
        libp2p3.services.pubsub.unsubscribe(topic)
      })
    })
  })
})
