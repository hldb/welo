import { assert } from 'aegir/chai'
import { start, stop } from '@libp2p/interfaces/startable'
import { Key } from 'interface-datastore'
import { MemoryDatastore, NamespaceDatastore } from 'datastore-core'

import { LiveReplicator as Replicator } from '@/replicator/live/index.js'
import { Replica } from '@/replica/index.js'
import { StaticAccess as Access } from '@/access/static/index.js'
import staticAccessProtocol from '@/access/static/protocol.js'

import { getMemoryDatastore } from './utils/storage.js'
import { getTestPaths, tempPath, TestPaths } from './utils/constants.js'
import { getTestManifest } from './utils/manifest.js'
import { getTestIdentities, getTestIdentity } from './utils/identities.js'
import { basalEntry } from '@/entry/basal/index.js'
import { basalIdentity } from '@/identity/basal/index.js'
import type { Multiaddr } from '@multiformats/multiaddr'
import { getDhtService, getIdentifyService, getPubsubService, type UsedServices } from './utils/libp2p/services.js'
import type { Helia } from '@helia/interface'
import { createLibp2p, Libp2pOptions, type Libp2p } from 'libp2p'
import { getLibp2pDefaults } from './utils/libp2p/defaults.js'
import { getPeerDiscovery } from './utils/libp2p/peerDiscovery.js'
import { createHelia } from 'helia'
import { waitForMultiaddrs } from './utils/network.js'

const testName = 'live-replicator'

type TestServices = UsedServices<'identify' | 'pubsub' | 'dht'>

describe(testName, () => {
  let
    helia1: Helia<Libp2p<TestServices>>,
    helia2: Helia<Libp2p<TestServices>>,
    libp2p1: Libp2p<TestServices>,
    libp2p2: Libp2p<TestServices>,
    addr2: Multiaddr[],
    replica1: Replica,
    replica2: Replica,
    replicator1: Replicator,
    replicator2: Replicator,
    testPaths1: TestPaths,
    testPaths2: TestPaths,
    access: Access,
    datastore: MemoryDatastore,
    datastore1: NamespaceDatastore,
    datastore2: NamespaceDatastore

  before(async () => {
    // debug.enable('libp2p:*')

    testPaths1 = getTestPaths(tempPath, testName + '/1')
    testPaths2 = getTestPaths(tempPath, testName + '/2')

    datastore = getMemoryDatastore()
    datastore1 = new NamespaceDatastore(datastore, new Key(testPaths1.replica))
    datastore2 = new NamespaceDatastore(datastore, new Key(testPaths2.replica))

    const createLibp2pOptions = async (): Promise<Libp2pOptions<TestServices>> => ({
      ...(await getLibp2pDefaults()),
      peerDiscovery: await getPeerDiscovery(),
      services: {
        identify: getIdentifyService(),
        pubsub: getPubsubService(),
        dht: getDhtService(true)
      }
    })

    libp2p1 = await createLibp2p(await createLibp2pOptions())
    libp2p2 = await createLibp2p(await createLibp2pOptions())

    await Promise.all([
      waitForMultiaddrs(libp2p1),
      waitForMultiaddrs(libp2p2)
    ])

    helia1 = await createHelia({ libp2p: libp2p1 })
    helia2 = await createHelia({ libp2p: libp2p2 })

    addr2 = libp2p2.getMultiaddrs()

    const identities1 = await getTestIdentities(testPaths1)
    const identities2 = await getTestIdentities(testPaths2)

    const identity1 = await getTestIdentity(
      identities1,
      libp2p1.keychain,
      testName
    )
    const identity2 = await getTestIdentity(
      identities2,
      libp2p2.keychain,
      testName
    )

    const write = [identity1.id, identity2.id]
    const accessConfig = {
      access: { protocol: staticAccessProtocol, config: { write } }
    }
    const manifest = await getTestManifest(testName, accessConfig)

    access = new Access({ manifest })
    await start(access)

    replica1 = new Replica({
      manifest,
      datastore: datastore1,
      blockstore: helia1.blockstore,
      access,
      identity: identity1,
      components: {
        entry: basalEntry(),
        identity: basalIdentity()
      }
    })
    replica2 = new Replica({
      manifest,
      datastore: datastore2,
      blockstore: helia2.blockstore,
      access,
      identity: identity2,
      components: {
        entry: basalEntry(),
        identity: basalIdentity()
      }
    })
    await start(replica1, replica2)

    replicator1 = new Replicator({
      ipfs: helia1,
      replica: replica1,
      datastore: datastore1,
      blockstore: helia1.blockstore
    })
    replicator2 = new Replicator({
      ipfs: helia2,
      replica: replica2,
      datastore: datastore2,
      blockstore: helia2.blockstore
    })
  })

  after(async () => {
    await stop(access)
    await stop(replicator1, replicator2)
    await stop(replica1, replica2)
    await stop(helia1)
    await stop(helia2)
  })

  describe('instance', () => {
    before(async () => {
      await start(replicator1, replicator2)
      await Promise.all([
        libp2p1.dial(addr2),
        new Promise(resolve => { libp2p2.addEventListener('peer:connect', resolve, { once: true }) })
      ])
    })

    it('exposes instance properties', () => {
      const replicator = replicator1
      assert.isOk(replicator.broadcast)
    })

    it('replicates replica entries and identities', async () => {
      const promise = replica1.write(new Uint8Array())

      await Promise.all([
        new Promise((resolve) => { replica2.events.addEventListener('update', resolve, { once: true }) }
        ),
        promise
      ])

      if (replica1.root == null || replica2.root == null) {
        throw new Error('replica root is null')
      }
      assert.equal(replica1.root.toString(), replica2.root.toString())
    })
  })
})
