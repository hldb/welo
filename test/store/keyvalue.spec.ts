import { assert } from 'aegir/chai'
import { start, stop } from '@libp2p/interface/startable'
import { NamespaceDatastore } from 'datastore-core'
import { Key } from 'interface-datastore'
import type { LevelDatastore } from 'datastore-level'

import { Keyvalue, keyvalueStore } from '@/store/keyvalue/index.js'
import keyvalueStoreProtocol from '@/store/keyvalue/protocol.js'
import { Replica } from '@/replica/index.js'
import { StaticAccess } from '@/access/static/index.js'
import staticAccessProtocol from '@/access/static/protocol.js'
import { basalEntry } from '@/entry/basal/index.js'
import { Identity, basalIdentity } from '@/identity/basal/index.js'
import { Manifest } from '@/manifest/index.js'

import { getNonVolatileStorage } from '../test-utils/storage.js'
import { getDefaultManifest } from '../test-utils/manifest.js'
import { getTestPaths, names, tempPath, TestPaths } from '../test-utils/constants.js'
import { getTestIdentities, getTestIdentity } from '../test-utils/identities.js'
import type { Blockstore } from 'interface-blockstore'
import { getTestKeyChain } from 'test/test-utils/keychain.js'

const testName = 'keyvalue'

describe(testName, () => {
  let
    blockstore: Blockstore,
    identity: Identity,
    testPaths: TestPaths,
    datastore: LevelDatastore

  const expectedProtocol = '/hldb/store/keyvalue'
  const storeModule = keyvalueStore()

  before(async () => {
    testPaths = getTestPaths(tempPath, testName)

    const storage = await getNonVolatileStorage(testPaths.store)
    datastore = storage.datastore
    await datastore.open()
    blockstore = storage.blockstore

    const identities = await getTestIdentities(testPaths)
    const keychain = getTestKeyChain()

    identity = await getTestIdentity(identities, keychain, names.name0)

    await blockstore.put(identity.block.cid, identity.block.bytes)
  })

  after(async () => {
    await datastore.close()
  })

  describe('class', () => {
    it('exposes static properties', () => {
      assert.isOk(storeModule)
      assert.strictEqual(keyvalueStoreProtocol, expectedProtocol)
    })
  })

  describe('instance', () => {
    let keyvalue: Keyvalue,
      replica: Replica,
      manifest: Manifest,
      access: StaticAccess
    const key = 'key'
    const value = 0

    before(async () => {
      manifest = await Manifest.create({
        ...getDefaultManifest('name', identity),
        access: {
          protocol: staticAccessProtocol,
          config: { write: [identity.id] }
        }
      })
      access = new StaticAccess({ manifest })
      await start(access)
      replica = new Replica({
        datastore: new NamespaceDatastore(datastore, new Key(testPaths.replica)),
        blockstore,
        manifest,
        access,
        identity,
        components: {
          entry: basalEntry(),
          identity: basalIdentity()
        }
      })
      await start(replica)
      keyvalue = storeModule.create({
        manifest,
        replica,
        datastore: new NamespaceDatastore(datastore, new Key(testPaths.store)),
        blockstore
      })
      await start(keyvalue)
    })

    after(async () => {
      await stop(keyvalue)
      await stop(replica)
    })

    it('exposes instance properties', () => {
      assert.isOk(keyvalue.start)
      assert.isOk(keyvalue.stop)
      // assert.isOk(keyvalue.events)
      assert.isOk(keyvalue.index)
      assert.isOk(keyvalue.creators)
      assert.isOk(keyvalue.selectors)
      assert.isOk(keyvalue.latest)
    })

    describe('update', () => {
      it('sets a key value pair to value', async () => {
        const payload = keyvalue.creators.put(key, value)
        const entry = await replica.write(payload)

        const index = await keyvalue.latest()

        assert.deepEqual(entry.payload, payload)
        assert.strictEqual(await keyvalue.selectors.get(index)(key), value)
      })

      it('deletes a key value pair', async () => {
        const payload = keyvalue.creators.del(key)
        const entry = await replica.write(payload)

        const index = await keyvalue.latest()

        assert.deepEqual(entry.payload, payload)
        assert.strictEqual(await keyvalue.selectors.get(index)(key), undefined)
      })

      it('updates a key value pair to new value', async () => {
        const payload = keyvalue.creators.put(key, value + 1)
        const entry = await replica.write(payload)

        const index = await keyvalue.latest()

        assert.deepEqual(entry.payload, payload)
        assert.strictEqual(await keyvalue.selectors.get(index)(key), value + 1)
      })
    })

    describe('reading persisted state', () => {
      it('can read persisted keyvalue state', async () => {
        await stop(keyvalue)
        await start(keyvalue)

        const index = keyvalue.index

        assert.strictEqual(await keyvalue.selectors.get(index)(key), value + 1)
      })
    })
  })
})
