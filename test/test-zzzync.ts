import { assert } from 'aegir/chai'
import { start, stop } from '@libp2p/interfaces/startable'
import type { LevelDatastore } from 'datastore-level'
import { Key } from 'interface-datastore'
import { NamespaceDatastore } from 'datastore-core'

import { zzzyncReplicator, type ZzzyncReplicator } from '@/replicator/zzzync/index.js'
import { Replica } from '@/replica/index.js'
import { StaticAccess as Access } from '@/access/static/index.js'
import staticAccessProtocol from '@/access/static/protocol.js'

import { getLevelDatastore, getVolatileStorage } from './utils/storage.js'
import { getTestPaths, tempPath, TestPaths } from './utils/constants.js'
import { getTestManifest } from './utils/manifest.js'
import { getTestIdentities, getTestIdentity } from './utils/identities.js'
import { basalEntry } from '@/entry/basal/index.js'
import { basalIdentity } from '@/identity/basal/index.js'
import { Web3Storage } from 'web3.storage'
import type { Ed25519PeerId } from '@libp2p/interface-peer-id'
import { createLibp2p, Libp2p, Libp2pOptions } from 'libp2p'
import type { CreateEphemeralLibp2p } from '@tabcat/zzzync/dist/src/advertisers/dht.js'
import { CID } from 'multiformats'
import { createEd25519PeerId } from '@libp2p/peer-id-factory'
import { getLibp2pDefaults } from './utils/libp2p/defaults.js'
import { getBlockPeerConnectionGater } from './utils/libp2p/connectionGater.js'
import { getIdentifyService, type AllServices, getPubsubService, getDhtService } from './utils/libp2p/services.js'
import type { Helia } from '@helia/interface'
import { createHelia } from 'helia'

const testName = 'zzzync-replicator'
const token = process.env.W3_TOKEN as string

const noToken = token == null

let _describe: Mocha.SuiteFunction | Mocha.PendingSuiteFunction
if (noToken) {
  // eslint-disable-next-line no-console
  console.log('no web3.storage token found at .w3_token. skipping zzzync replicator tests')
  _describe = describe.skip
} else {
  _describe = describe
}

type Services = Pick<AllServices, 'identify' | 'pubsub' | 'dht'>

_describe(testName, () => {
  let
    helia1: Helia<Libp2p<Services>>,
    helia2: Helia<Libp2p<Services>>,
    libp2p1: Libp2p<Services>,
    libp2p2: Libp2p<Services>,
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

    datastore = await getLevelDatastore(testPaths1.replica)
    await datastore.open()
    datastore1 = new NamespaceDatastore(datastore, new Key(testPaths1.replica))
    datastore2 = new NamespaceDatastore(datastore, new Key(testPaths2.replica))

    const peerId1 = await createEd25519PeerId()
    const peerId2 = await createEd25519PeerId()
    // blocks peering so block fetching happens over web3.storage
    const createLibp2pOptions = async (): Promise<Libp2pOptions<Services>> => ({
      ...(await getLibp2pDefaults()),
      services: {
        identify: getIdentifyService(),
        pubsub: getPubsubService(),
        dht: getDhtService(true)
      }
    })

    const storage1 = getVolatileStorage()
    const storage2 = getVolatileStorage()

    libp2p1 = await createLibp2p({
      ...(await createLibp2pOptions()),
      connectionGater: getBlockPeerConnectionGater(peerId2),
      datastore: storage1.datastore
    })
    libp2p2 = await createLibp2p({
      ...(await createLibp2pOptions()),
      connectionGater: getBlockPeerConnectionGater(peerId1),
      datastore: storage2.datastore
    })
    helia1 = await createHelia({
      ...storage1,
      libp2p: libp2p1
    })
    helia2 = await createHelia({
      ...storage2,
      libp2p: libp2p2
    })

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

    const client = new Web3Storage({ token })
    const createEphemeralLibp2p = async (peerId: Ed25519PeerId): ReturnType<CreateEphemeralLibp2p> => {
      const libp2p = await createLibp2p({
        ...(await createLibp2pOptions()),
        peerId
      })

      return { libp2p }
    }
    const replicator = zzzyncReplicator({ w3: { client }, createEphemeralLibp2p, scope: 'lan' })

    replicator1 = replicator.create({
      ipfs: helia1,
      replica: replica1,
      datastore: datastore1,
      blockstore: helia1.blockstore
    })
    replicator2 = replicator.create({
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

    it.skip('uploads and advertises replica data', async () => {
      await replica1.write(new Uint8Array())

      await replicator1.upload()
    })

    it.skip('downloads and merges replica data', async () => {
      await new Promise(resolve => setTimeout(resolve, 2000))
      await replicator2.download()

      if (!(replica1.root instanceof CID) || !(replica2.root instanceof CID)) {
        throw new Error()
      }
      assert.equal(replica1.root.toString(), replica2.root.toString())
    })
  })
})
