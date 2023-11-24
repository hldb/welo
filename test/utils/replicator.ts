import { assert } from 'aegir/chai'
import { start, stop } from '@libp2p/interfaces/startable'
import { Key } from 'interface-datastore'
import { StaticAccess as Access } from '@/access/static/index.js'
import { NamespaceDatastore } from 'datastore-core'
import { Replica } from '@/replica/index.js'
import { getLevelBlockstore, getLevelDatastore } from '../test-utils/storage.js'
import { getTestPaths, tempPath, TestPaths } from '../test-utils/constants.js'
import { getTestIdentities, getTestIdentity } from '../test-utils/identities.js'
import { getTestManifest } from '../test-utils/manifest.js'
import { basalEntry } from '@/entry/basal/index.js'
import { basalIdentity } from '@/identity/basal/index.js'
import staticAccessProtocol from '@/access/static/protocol.js'
import type { Replicator, ReplicatorModule } from '@/replicator/interface.js'
import type { LevelDatastore } from 'datastore-level'
import type { GossipHelia, GossipLibp2p } from '@/interface'
import type { Multiaddr } from '@multiformats/multiaddr'
import { waitForMultiaddrs } from 'test/test-utils/network.js'
import { Libp2pOptions, createLibp2p } from 'libp2p'
import { getLibp2pDefaults } from 'test/test-utils/libp2p/defaults.js'
import { getPeerDiscovery } from 'test/test-utils/libp2p/peerDiscovery.js'
import { getDhtService, getIdentifyService, getPubsubService, AllServices } from 'test/test-utils/libp2p/services.js'
import { createHelia } from 'helia'
import { createEd25519PeerId } from '@libp2p/peer-id-factory'

export interface SetupComponents<R extends Replicator = Replicator> {
  ipfs1: GossipHelia
  ipfs2: GossipHelia
  libp2p1: GossipLibp2p
  libp2p2: GossipLibp2p
  addr2: Multiaddr
  replica1: Replica
  replica2: Replica
  replicator1: R
  replicator2: R
  testPaths1: TestPaths
  testPaths2: TestPaths
  access: Access
  datastore: LevelDatastore
  datastore1: NamespaceDatastore
  datastore2: NamespaceDatastore
}

export const setup = async <R extends Replicator, M extends ReplicatorModule<R>>(name: string, replicatorModule: M): Promise<SetupComponents<R>> => {
  const testPaths1 = getTestPaths(tempPath, name + '/1')
  const testPaths2 = getTestPaths(tempPath, name + '/2')

  const createLibp2pOptions = async (): Promise<Libp2pOptions<AllServices>> => ({
    ...(await getLibp2pDefaults()),
    peerDiscovery: await getPeerDiscovery(),
    services: {
      identify: getIdentifyService(),
      pubsub: getPubsubService(),
      dht: getDhtService(true)
    }
  })

  const datastore = await getLevelDatastore(testPaths1.replica + '/data')
  await datastore.open()
  const datastore1 = new NamespaceDatastore(datastore, new Key(testPaths1.replica))
  const datastore2 = new NamespaceDatastore(datastore, new Key(testPaths2.replica))

  const blockstore1 = await getLevelBlockstore(testPaths1.replica + '/blocks')
  const blockstore2 = await getLevelBlockstore(testPaths2.replica + '/blocks')

  const peerId1 = await createEd25519PeerId()
  const peerId2 = await createEd25519PeerId()

  const libp2p1 = await createLibp2p({
    ...(await createLibp2pOptions()),
    peerId: peerId1,
    datastore: datastore1
  })
  const libp2p2 = await createLibp2p({
    ...(await createLibp2pOptions()),
    peerId: peerId2,
    datastore: datastore2
  })

  await Promise.all([
    waitForMultiaddrs(libp2p1),
    waitForMultiaddrs(libp2p2)
  ])

  const ipfs1 = await createHelia({
    datastore: datastore1,
    blockstore: blockstore1,
    libp2p: libp2p1
  })
  const ipfs2 = await createHelia({
    datastore: datastore2,
    blockstore: blockstore2,
    libp2p: libp2p2
  })

  const addr2 = ipfs2.libp2p.getMultiaddrs()[0]

  const identities1 = await getTestIdentities(testPaths1)
  const identities2 = await getTestIdentities(testPaths2)

  const identity1 = await getTestIdentity(
    identities1,
    libp2p1.keychain,
    name
  )
  const identity2 = await getTestIdentity(
    identities2,
    libp2p2.keychain,
    name
  )

  const write = [identity1.id, identity2.id]
  const accessConfig = {
    access: { protocol: staticAccessProtocol, config: { write } }
  }
  const manifest = await getTestManifest(name, accessConfig)

  await ipfs1.blockstore.put(manifest.block.cid, manifest.block.bytes)
  await ipfs2.blockstore.put(manifest.block.cid, manifest.block.bytes)

  const access = new Access({ manifest })
  await start(access)

  const replica1 = new Replica({
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
  const replica2 = new Replica({
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

  const replicator1 = replicatorModule.create({
    peerId: peerId1,
    replica: replica1,
    datastore: datastore1,
    blockstore: ipfs1.blockstore
  })
  const replicator2 = replicatorModule.create({
    peerId: peerId2,
    replica: replica2,
    datastore: datastore1,
    blockstore: ipfs2.blockstore
  })

  return {
    ipfs1,
    ipfs2,
    libp2p1,
    libp2p2,
    addr2,
    replica1,
    replica2,
    replicator1,
    replicator2,
    testPaths1,
    testPaths2,
    access,
    datastore,
    datastore1,
    datastore2
  }
}

export const teardown = async <R extends Replicator>(components: SetupComponents<R>): Promise<void> => {
  await stop(components.access)
  await stop(components.replicator1, components.replicator2)
  await stop(components.replica1, components.replica2)
  await stop(components.ipfs1)
  await stop(components.ipfs2)
  await components.datastore?.close()
}

export const instanceSetup = async <R extends Replicator>(components: SetupComponents<R>): Promise<void> => {
  await start(components.replicator1, components.replicator2)

  const connectPromise = new Promise(resolve => {
    components.libp2p2.addEventListener('peer:connect', resolve, { once: true })
  })

  await components.libp2p1.dial(components.addr2)
  await connectPromise
}

export const awaitPubsubJoin = async <R extends Replicator>(components: SetupComponents<R>, topic: string): Promise<void> => {
  const awaitTopicJoin = async (libp2p1: GossipLibp2p, libp2p2: GossipLibp2p): Promise<void> => {
    await new Promise<void>(resolve => {
      libp2p1.services.pubsub.addEventListener('subscription-change', evt => {
        if (!evt.detail.peerId.equals(libp2p2.peerId)) {
          return
        }

        if (evt.detail.subscriptions.find(s => s.topic === topic && s.subscribe) == null) {
          return
        }

        resolve()
      })
    })
  }

  await Promise.all([
    awaitTopicJoin(components.libp2p1, components.libp2p2),
    awaitTopicJoin(components.libp2p2, components.libp2p1)
  ])
}

export const liveReplicationTest = async ({ replica1, replica2 }: Pick<SetupComponents, 'replica1' | 'replica2'>): Promise<void> => {
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
}
