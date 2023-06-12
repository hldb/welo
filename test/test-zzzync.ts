import { assert } from './utils/chai.js'
import { start, stop } from '@libp2p/interfaces/startable'
import type { LevelDatastore } from 'datastore-level'
import { Key } from 'interface-datastore'
import { NamespaceDatastore } from 'datastore-core'
import type { GossipHelia, GossipLibp2p } from '@/interface'
import { ipnsSelector } from 'ipns/selector'
import { ipnsValidator } from 'ipns/validator'

import { zzzyncReplicator, type ZzzyncReplicator } from '@/replicator/zzzync/index.js'
import { Blocks } from '@/blocks/index.js'
import { Replica } from '@/replica/index.js'
import { StaticAccess as Access } from '@/access/static/index.js'
import staticAccessProtocol from '@/access/static/protocol.js'

import getDatastore from './utils/level-datastore.js'
import { getTestIpfs, localIpfsOptions, getMultiaddr } from './utils/ipfs.js'
import { getTestPaths, tempPath, TestPaths } from './utils/constants.js'
import { getTestManifest } from './utils/manifest.js'
import { getTestIdentities, getTestIdentity } from './utils/identities.js'
import { basalEntry } from '@/entry/basal/index.js'
import { basalIdentity } from '@/identity/basal/index.js'
import type { Multiaddr } from '@multiformats/multiaddr'
import { Web3Storage } from 'web3.storage'
import type { Ed25519PeerId } from '@libp2p/interface-peer-id'
import { createLibp2p, Libp2p } from 'libp2p'
import { createLibp2pOptions } from './utils/libp2p-options.js'
import { identifyService } from 'libp2p/identify'
import { gossipsub } from '@chainsafe/libp2p-gossipsub'
import { kadDHT } from '@libp2p/kad-dht'
import type { Libp2pWithDHT } from '@tabcat/zzzync/dist/src/advertisers/dht.js'
import { CID } from 'multiformats'

const testName = 'zzzync-replicator'
const token = process.env.W3_TOKEN as string

const noToken = token == null

let _describe: Mocha.SuiteFunction | Mocha.PendingSuiteFunction
if (noToken) {
  console.log('no web3.storage token found at .w3_token. skipping zzzync replicator tests')
  _describe = describe.skip
} else {
  _describe = describe
}

_describe(testName, () => {
  let
    server: Libp2p,
    ipfs1: GossipHelia,
    ipfs2: GossipHelia,
    libp2p1: GossipLibp2p,
    libp2p2: GossipLibp2p,
    addr2: Multiaddr,
    replica1: Replica,
    replica2: Replica,
    replicator1: ZzzyncReplicator,
    replicator2: ZzzyncReplicator,
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

    const blocks1 = new Blocks(ipfs1)
    const blocks2 = new Blocks(ipfs2)

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
      blocks: blocks1,
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
      blocks: blocks2,
      access,
      identity: identity2,
      components: {
        entry: basalEntry(),
        identity: basalIdentity()
      }
    })
    await start(replica1, replica2)

    server = await createLibp2p(createLibp2pOptions({
      services: {
        identify: identifyService(),
        pubsub: gossipsub(),
        dht: kadDHT({
          clientMode: false,
          validators: { ipns: ipnsValidator },
          selectors: { ipns: ipnsSelector }
        })
      }
    }))

    const client = new Web3Storage({ token })
    const createEphemeralLibp2p = async (peerId: Ed25519PeerId): Promise<Libp2pWithDHT> => {
      const libp2p = await createLibp2p(createLibp2pOptions({ peerId }))

      await libp2p.dialProtocol(server.getMultiaddrs(), '/ipfs/lan/kad/1.0.0')

      return libp2p
    }
    const replicator = zzzyncReplicator({ w3: { client }, createEphemeralLibp2p })

    replicator1 = replicator.create({
      ipfs: ipfs1,
      blocks: blocks1,
      replica: replica1,
      datastore: datastore1,
      blockstore: ipfs1.blockstore
    })
    replicator2 = replicator.create({
      ipfs: ipfs2,
      blocks: blocks2,
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
    await stop(server)
    await datastore.close()
  })

  describe('instance', () => {
    it('exposes instance properties', () => {
      const replicator = replicator1
      assert.isOk(replicator.download)
      assert.isOk(replicator.upload)
    })

    before(async () => {
      await start(replicator1, replicator2)

      await Promise.all([
        libp2p1.dial(addr2),
        new Promise(resolve => libp2p2.addEventListener('peer:connect', resolve, { once: true })),
        libp2p1.dialProtocol(server.getMultiaddrs(), '/ipfs/lan/kad/1.0.0'),
        libp2p2.dialProtocol(server.getMultiaddrs(), '/ipfs/lan/kad/1.0.0')
      ])
    })

    it('uploads and advertises replica data', async () => {
      await replica1.write(new Uint8Array())

      // provide hangs
      await Promise.race([
        new Promise(resolve => setTimeout(resolve, 4000)),
        replicator1.upload()
      ])
    })

    it('downloads and merges replica data', async () => {
      await new Promise(resolve => setTimeout(resolve, 2000))
      await replicator2.download()

      if (!(replica1.root instanceof CID) || !(replica2.root instanceof CID)) {
        throw new Error()
      }
      assert.equal(replica1.root.toString(), replica2.root.toString())
    })
  })
})
