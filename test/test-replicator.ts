import { assert } from './utils/chai.js'
import { start, stop } from '@libp2p/interfaces/startable'
import type { LevelDatastore } from 'datastore-level'
import { Key } from 'interface-datastore'
import { NamespaceDatastore } from 'datastore-core'
import type { GossipHelia, GossipLibp2p } from '@/interface'

import { LiveReplicator as Replicator } from '@/replicator/live/index.js'
import { Replica } from '@/replica/index.js'
import { StaticAccess as Access } from '@/access/static/index.js'
import staticAccessProtocol from '@/access/static/protocol.js'

import getDatastore from './utils/level-datastore.js'
import { getMultiaddr, getTestIpfs, localIpfsOptions } from './utils/ipfs.js'
import { getTestPaths, tempPath, TestPaths } from './utils/constants.js'
import { getTestManifest } from './utils/manifest.js'
import { getTestIdentities, getTestIdentity } from './utils/identities.js'
import { basalEntry } from '@/entry/basal/index.js'
import { basalIdentity } from '@/identity/basal/index.js'
import type { Multiaddr } from '@multiformats/multiaddr'

const testName = 'live-replicator'

describe(testName, () => {
  let ipfs1: GossipHelia,
    ipfs2: GossipHelia,
    libp2p1: GossipLibp2p,
    libp2p2: GossipLibp2p,
    addr2: Multiaddr,
    replica1: Replica,
    replica2: Replica,
    replicator1: Replicator,
    replicator2: Replicator,
    testPaths1: TestPaths,
    testPaths2: TestPaths,
    access: Access,
    datastore: LevelDatastore,
    datastore1: NamespaceDatastore,
    datastore2: NamespaceDatastore

  before(async () => {
    testPaths1 = getTestPaths(tempPath, testName + '/1')
    testPaths2 = getTestPaths(tempPath, testName + '/2')

    datastore = await getDatastore(testPaths1.replica)
    await datastore.open()
    datastore1 = new NamespaceDatastore(datastore, new Key(testPaths1.replica))
    datastore2 = new NamespaceDatastore(datastore, new Key(testPaths2.replica))

    ipfs1 = await getTestIpfs(testPaths1, localIpfsOptions)
    ipfs2 = await getTestIpfs(testPaths2, localIpfsOptions)
    libp2p1 = ipfs1.libp2p
    libp2p2 = ipfs2.libp2p

    addr2 = await getMultiaddr(ipfs2)

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
      blockstore: ipfs1.blockstore,
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
      blockstore: ipfs2.blockstore,
      access,
      identity: identity2,
      components: {
        entry: basalEntry(),
        identity: basalIdentity()
      }
    })
    await start(replica1, replica2)

    replicator1 = new Replicator({
      ipfs: ipfs1,
      replica: replica1,
      datastore: datastore1,
      blockstore: ipfs1.blockstore
    })
    replicator2 = new Replicator({
      ipfs: ipfs2,
      replica: replica2,
      datastore: datastore2,
      blockstore: ipfs2.blockstore
    })
  })

  after(async () => {
    await stop(access)
    await stop(replicator1, replicator2)
    await stop(replica1, replica2)
    await stop(ipfs1)
    await stop(ipfs2)
    await datastore.close()
  })

  describe('instance', () => {
    it('exposes instance properties', () => {
      const replicator = replicator1
      assert.isOk(replicator.broadcast)
    })

    before(async () => {
      await start(replicator1, replicator2)
      await Promise.all([
        libp2p1.dial(addr2),
        new Promise(resolve => { libp2p2.addEventListener('peer:connect', resolve, { once: true }) })
      ])
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
