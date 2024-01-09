import { assert } from 'aegir/chai'

import { Database } from '@/database.js'
import { keyvalueStore } from '@/store/keyvalue/index.js'
import { staticAccess } from '@/access/static/index.js'
import staticAccessProtocol from '@/access/static/protocol.js'
import { basalEntry } from '@/entry/basal/index.js'
import { Identity, basalIdentity } from '@/identity/basal/index.js'
import { Manifest } from '@/manifest/index.js'

import { getVolatileStorage } from '../test-utils/storage.js'
import { getDefaultManifest } from '../test-utils/manifest.js'
import { getTestPaths, tempPath } from '../test-utils/constants.js'
import { getTestIdentities, getTestIdentity } from '../test-utils/identities.js'
import type { Blockstore } from 'interface-blockstore'
import type { Datastore } from 'interface-datastore'
import { Libp2p, createLibp2p } from 'libp2p'
import { getLibp2pDefaults } from '../test-utils/libp2p/defaults.js'
import { createHelia } from 'helia'
import type { UsedServices } from '../test-utils/libp2p/services.js'
import type { Helia } from '@helia/interface'

const testName = 'database'

// can be removed after type changes to welo
type TestServices = UsedServices<'identify' | 'pubsub'>

describe(testName, () => {
  let
    helia: Helia<Libp2p<TestServices>>,
    libp2p: Libp2p<TestServices>,
    database: Database,
    manifest: Manifest,
    identity: Identity,
    datastore: Datastore,
    blockstore: Blockstore

  before(async () => {
    const testPaths = getTestPaths(tempPath, testName)
    const storage = getVolatileStorage()
    datastore = storage.datastore
    blockstore = storage.blockstore

    libp2p = await createLibp2p<TestServices>(await getLibp2pDefaults())
    helia = await createHelia({
      datastore,
      blockstore,
      libp2p
    })

    const identities = await getTestIdentities(testPaths)

    identity = await getTestIdentity(identities, libp2p.keychain, testName)

    manifest = await Manifest.create({
      ...getDefaultManifest('name', identity),
      access: {
        protocol: staticAccessProtocol,
        config: { write: [identity.id] }
      }
    })
  })

  after(async () => {
    await helia.stop()
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
          ipfs: helia,
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
