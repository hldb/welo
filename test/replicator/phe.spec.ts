import { assert } from 'aegir/chai'
import { start, stop } from '@libp2p/interface/startable'
import { Key } from 'interface-datastore'
import { MemoryDatastore, NamespaceDatastore } from 'datastore-core'

import { PheReplicator } from '@/replicator/phe/index.js'
import { Replica } from '@/replica/index.js'
import { StaticAccess as Access } from '@/access/static/index.js'
import staticAccessProtocol from '@/access/static/protocol.js'

import { getMemoryDatastore } from '../test-utils/storage.js'
import { getTestPaths, tempPath, TestPaths } from '../test-utils/constants.js'
import { getTestManifest } from '../test-utils/manifest.js'
import { getTestIdentities, getTestIdentity } from '../test-utils/identities.js'
import { basalEntry } from '@/entry/basal/index.js'
import { basalIdentity } from '@/identity/basal/index.js'
import { getTestKeyChain } from 'test/test-utils/keychain.js'
import { MemoryBlockstore } from 'blockstore-core'
import type { Ed25519PeerId } from '@libp2p/interface/dist/src/peer-id/index.js'
import { createEd25519PeerId } from '@libp2p/peer-id-factory'
import { getTestPubSubNetwork } from 'test/test-mocks/pubsub.js'
import type { PubSub } from '@libp2p/interface/pubsub'

const testName = 'replicator/phe'

describe(testName, () => {
  let
    id1: Ed25519PeerId,
    id2: Ed25519PeerId,
    pubsub1: PubSub,
    pubsub2: PubSub,
    replica1: Replica,
    replica2: Replica,
    replicator1: PheReplicator,
    replicator2: PheReplicator,
    testPaths1: TestPaths,
    testPaths2: TestPaths,
    access: Access,
    datastore: MemoryDatastore,
    datastore1: NamespaceDatastore,
    datastore2: NamespaceDatastore,
    blockstore: MemoryBlockstore

  before(async () => {
    id1 = await createEd25519PeerId()
    id2 = await createEd25519PeerId()

    const { createPubSubPeer } = getTestPubSubNetwork()
    pubsub1 = createPubSubPeer(id1)
    pubsub2 = createPubSubPeer(id2)

    testPaths1 = getTestPaths(tempPath, testName + '/1')
    testPaths2 = getTestPaths(tempPath, testName + '/2')

    datastore = getMemoryDatastore()
    datastore1 = new NamespaceDatastore(datastore, new Key(testPaths1.replica))
    datastore2 = new NamespaceDatastore(datastore, new Key(testPaths2.replica))

    const identities1 = await getTestIdentities(testPaths1)
    const identities2 = await getTestIdentities(testPaths2)
    const keychain1 = getTestKeyChain()
    const keychain2 = getTestKeyChain()

    const identity1 = await getTestIdentity(
      identities1,
      keychain1,
      testName
    )
    const identity2 = await getTestIdentity(
      identities2,
      keychain2,
      testName
    )

    blockstore = new MemoryBlockstore()

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
      blockstore,
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
      blockstore,
      access,
      identity: identity2,
      components: {
        entry: basalEntry(),
        identity: basalIdentity()
      }
    })
    await start(replica1, replica2)

    replicator1 = new PheReplicator({
      peerId: id1,
      pubsub: pubsub1,
      replica: replica1,
      datastore: datastore1,
      blockstore
    })
    replicator2 = new PheReplicator({
      peerId: id2,
      pubsub: pubsub2,
      replica: replica2,
      datastore: datastore2,
      blockstore
    })
  })

  after(async () => {
    await stop(access)
    await stop(replicator1, replicator2)
    await stop(replica1, replica2)
  })

  describe('instance', () => {
    before(async () => {
      await start(replicator1, replicator2)
    })


    it('replicates replica entries and identities', async () => {
      const promise = replica1.write(new Uint8Array())

      await Promise.all([
        new Promise((resolve) =>
          replica2.events.addEventListener('update', resolve, { once: true })
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
