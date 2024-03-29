import path from 'path'
import { assert } from 'aegir/chai'
import { getTestPaths, tempPath } from './utils/constants.js'
import defaultManifest from './utils/default-manifest.js'
import { getTestIdentities, getTestIdentity } from './utils/identities.js'
import { getTestIpfs, offlineIpfsOptions } from './utils/ipfs.js'
import getDatastore from './utils/level-datastore.js'
import { getTestLibp2p } from './utils/libp2p.js'
import type { GossipHelia, GossipLibp2p } from '@/interface'
import type { LevelDatastore } from 'datastore-level'
import type { Blockstore } from 'interface-blockstore'
import { staticAccess } from '@/access/static/index.js'
import staticAccessProtocol from '@/access/static/protocol.js'
import { Database } from '@/database.js'
import { basalEntry } from '@/entry/basal/index.js'
import { type Identity, basalIdentity } from '@/identity/basal/index.js'
import { Manifest } from '@/manifest/index.js'
import { keyvalueStore } from '@/store/keyvalue/index.js'

const testName = 'database'

describe(testName, () => {
  let ipfs: GossipHelia,
    libp2p: GossipLibp2p,
    database: Database,
    manifest: Manifest,
    identity: Identity,
    directory: string,
    datastore: LevelDatastore,
    blockstore: Blockstore

  before(async () => {
    const testPaths = getTestPaths(tempPath, testName)
    ipfs = await getTestIpfs(testPaths, offlineIpfsOptions)
    blockstore = ipfs.blockstore

    const identities = await getTestIdentities(testPaths)
    libp2p = await getTestLibp2p(ipfs)

    identity = await getTestIdentity(identities, libp2p.services.keychain, testName)

    manifest = await Manifest.create({
      ...defaultManifest('name', identity),
      access: {
        protocol: staticAccessProtocol,
        config: { write: [identity.id] }
      }
    })

    directory = path.join(testPaths.test, manifest.address.toString())

    datastore = await getDatastore(directory)
  })

  after(async () => {
    await datastore.close()
    await ipfs.stop()
  })

  describe('class', () => {
    it('exposes static properties', () => {
      assert.isOk(Database.open)
    })

    describe('open', () => {
      it('returns a new Database instance', async () => {
        database = await Database.open({
          datastore,
          manifest,
          identity,
          ipfs,
          blockstore,
          replicators: [], // empty replicator
          components: {
            store: keyvalueStore(),
            access: staticAccess(),
            entry: basalEntry(),
            identity: basalIdentity()
          }
        })
      })
    })
  })

  describe('instance', () => {
    it('exposes instance properties', () => {
      assert.isOk(database.identity)
      assert.isOk(database.replica)
      assert.isOk(database.manifest)
      assert.isOk(database.store)
      assert.isOk(database.access)
      assert.isOk(database.components.entry)
      assert.isOk(database.components.identity)
      // see about doing this with generics
      // assert.isOk(database.put);
      // assert.isOk(database.del);
      // assert.isOk(database.get);
      assert.isOk(database.events)
      assert.isOk(database.close)
    })

    describe('close', () => {
      it('resets the database state', async () => {
        assert.strictEqual(database.isStarted(), true)
        await database.close()
        assert.strictEqual(database.isStarted(), false)
      })
    })
  })
})
