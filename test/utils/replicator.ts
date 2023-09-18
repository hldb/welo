import { assert } from 'aegir/chai'
import { start, stop } from '@libp2p/interfaces/startable'
import { Key } from 'interface-datastore'
import { StaticAccess as Access } from '@/access/static/index.js'
import { NamespaceDatastore } from 'datastore-core'
import { Replica } from '@/replica/index.js'
import getDatastore from './level-datastore.js'
import { getTestPaths, tempPath, TestPaths } from './constants.js'
import { getMultiaddr, getTestIpfs, localIpfsOptions } from './ipfs.js'
import { getTestIdentities, getTestIdentity } from './identities.js'
import { getTestManifest } from './manifest.js'
import { basalEntry } from '@/entry/basal/index.js'
import { basalIdentity } from '@/identity/basal/index.js'
import staticAccessProtocol from '@/access/static/protocol.js'
import type { Replicator, ReplicatorModule } from '@/replicator/interface.js'
import type { LevelDatastore } from 'datastore-level'
import type { GossipHelia, GossipLibp2p } from '@/interface'
import type { Multiaddr } from '@multiformats/multiaddr'

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

  const datastore = await getDatastore(testPaths1.replica)
  await datastore.open()
  const datastore1 = new NamespaceDatastore(datastore, new Key(testPaths1.replica))
  const datastore2 = new NamespaceDatastore(datastore, new Key(testPaths2.replica))

  const ipfs1 = await getTestIpfs(testPaths1, localIpfsOptions)
  const ipfs2 = await getTestIpfs(testPaths2, localIpfsOptions)
  const libp2p1 = ipfs1.libp2p
  const libp2p2 = ipfs2.libp2p

  const addr2 = await getMultiaddr(ipfs2)

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
    ipfs: ipfs1,
    replica: replica1,
    datastore: datastore1,
    blockstore: ipfs1.blockstore
  })
  const replicator2 = replicatorModule.create({
    ipfs: ipfs2,
    replica: replica2,
    datastore: datastore2,
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
  await Promise.all([
    components.libp2p1.dial(components.addr2),
    new Promise(resolve => { components.libp2p2.addEventListener('peer:connect', resolve, { once: true }) })
  ])
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
