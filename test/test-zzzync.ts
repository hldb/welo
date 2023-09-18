/* eslint-disable no-console */
import { assert } from 'aegir/chai'
import { start, stop } from '@libp2p/interfaces/startable'
import type { LevelDatastore } from 'datastore-level'
import { Key } from 'interface-datastore'
import { NamespaceDatastore } from 'datastore-core'
import type { GossipHelia, GossipLibp2p } from '@/interface'

import { zzzyncReplicator, type ZzzyncReplicator } from '@/replicator/zzzync/index.js'
import { Replica } from '@/replica/index.js'
import { StaticAccess as Access } from '@/access/static/index.js'
import staticAccessProtocol from '@/access/static/protocol.js'

import getDatastore from './utils/level-datastore.js'
import { getTestIpfs, localIpfsOptions } from './utils/ipfs.js'
import { getTestPaths, tempPath, TestPaths } from './utils/constants.js'
import { getTestManifest } from './utils/manifest.js'
import { getTestIdentities, getTestIdentity } from './utils/identities.js'
import { basalEntry } from '@/entry/basal/index.js'
import { basalIdentity } from '@/identity/basal/index.js'
import { Web3Storage } from 'web3.storage'
import type { Ed25519PeerId, PeerId } from '@libp2p/interface-peer-id'
import { createLibp2p, Libp2pOptions } from 'libp2p'
import { createLibp2pOptions } from './utils/libp2p-options.js'
import type { CreateEphemeralLibp2p } from '@tabcat/zzzync/dist/src/advertisers/dht.js'
import { CID } from 'multiformats'
import { createEd25519PeerId } from '@libp2p/peer-id-factory'
import { isBrowser } from 'wherearewe'

const testName = 'zzzync-replicator'
const token = process.env.W3_TOKEN

const noToken = typeof token === 'string' && token.length === 0

let _describe: Mocha.SuiteFunction | Mocha.PendingSuiteFunction
if (noToken) {
  // eslint-disable-next-line no-console
  console.log('no web3.storage token found at .w3_token. skipping zzzync replicator tests')
  _describe = describe.skip
} else {
  _describe = describe
}

if (isBrowser) {
  _describe = describe.skip
}

_describe(testName, () => {
  let
    ipfs1: GossipHelia,
    ipfs2: GossipHelia,
    libp2p1: GossipLibp2p,
    libp2p2: GossipLibp2p,
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

    const peerId1 = await createEd25519PeerId()
    const peerId2 = await createEd25519PeerId()
    // blocks peering so block fetching happens over web3.storage
    const getLibp2pOptions = (peerId: Ed25519PeerId, neighbor: Ed25519PeerId): Libp2pOptions => ({
      peerId,
      connectionGater: {
        denyDialPeer: async () => false,
        denyDialMultiaddr: async () => false,
        denyInboundConnection: async () => false,
        denyOutboundConnection: async () => false,
        denyInboundEncryptedConnection: async () => false,
        denyOutboundEncryptedConnection: async () => false,
        denyInboundUpgradedConnection: async () => false,
        denyOutboundUpgradedConnection: async () => false,
        filterMultiaddrForPeer: async (peerId: PeerId) => !peerId.equals(neighbor)
      }
    })
    ipfs1 = await getTestIpfs(testPaths1, localIpfsOptions, getLibp2pOptions(peerId1, peerId2))
    ipfs2 = await getTestIpfs(testPaths2, localIpfsOptions, getLibp2pOptions(peerId2, peerId1))
    libp2p1 = ipfs1.libp2p
    libp2p2 = ipfs2.libp2p

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

    if (token == null) {
      throw new Error('w3 token is undefined')
    }

    const client = new Web3Storage({ token })
    const createEphemeralLibp2p = async (peerId: Ed25519PeerId): ReturnType<CreateEphemeralLibp2p> => {
      const libp2p = await createLibp2p(await createLibp2pOptions({ peerId }))

      return { libp2p }
    }
    const replicator = zzzyncReplicator({ w3: { client }, createEphemeralLibp2p, scope: 'lan' })

    replicator1 = replicator.create({
      ipfs: ipfs1,
      replica: replica1,
      datastore: datastore1,
      blockstore: ipfs1.blockstore
    })
    replicator2 = replicator.create({
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
    before(async () => {
      await start(replicator1, replicator2)
    })

    it('exposes instance properties', () => {
      const replicator = replicator1
      assert.isOk(replicator.download)
      assert.isOk(replicator.upload)
    })

    it('uploads and advertises replica data', async () => {
      await replica1.write(new Uint8Array())

      await replicator1.upload()
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
