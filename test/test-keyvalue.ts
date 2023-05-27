import { assert } from './utils/chai.js'
import { start, stop } from '@libp2p/interfaces/startable'
import { NamespaceDatastore } from 'datastore-core'
import { Key } from 'interface-datastore'
import type { LevelDatastore } from 'datastore-level'
import type { Helia } from '@helia/interface'

import { Keyvalue, createKeyValueStore } from '@/store/keyvalue/index.js'
import keyvalueStoreProtocol from '@/store/keyvalue/protocol.js'
import { Replica } from '@/replica/index.js'
import { Blocks } from '@/blocks/index.js'
import { StaticAccess } from '@/access/static/index.js'
import staticAccessProtocol from '@/access/static/protocol.js'
import { createBasalEntry } from '@/entry/basal/index.js'
import { Identity, createBasalIdentity } from '@/identity/basal/index.js'
import { Manifest } from '@/manifest/index.js'

import getDatastore from './utils/level-datastore.js'
import defaultManifest from './utils/default-manifest.js'
import { getTestPaths, names, tempPath, TestPaths } from './utils/constants.js'
import { getTestIpfs, offlineIpfsOptions } from './utils/ipfs.js'
import { getTestIdentities, getTestIdentity } from './utils/identities.js'
import { getTestLibp2p } from './utils/libp2p.js'

const testName = 'keyvalue'

describe(testName, () => {
  let ipfs: Helia, blocks: Blocks, identity: Identity, testPaths: TestPaths, datastore: LevelDatastore
  const expectedProtocol = '/hldb/store/keyvalue'
  const storeModule = createKeyValueStore()

  before(async () => {
    testPaths = getTestPaths(tempPath, testName)
    datastore = await getDatastore(tempPath)
    await datastore.open()
    ipfs = await getTestIpfs(testPaths, offlineIpfsOptions)
    blocks = new Blocks(ipfs)

    const identities = await getTestIdentities(testPaths)
    const libp2p = await getTestLibp2p(ipfs)
    const keychain = libp2p.keychain

    identity = await getTestIdentity(identities, keychain, names.name0)

    await blocks.put(identity.block)
  })

  after(async () => {
    await datastore.close()
    await ipfs.stop()
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
        ...defaultManifest('name', identity),
        access: {
          protocol: staticAccessProtocol,
          config: { write: [identity.id] }
        }
      })
      access = new StaticAccess({ manifest })
      await start(access)
      replica = new Replica({
        datastore: new NamespaceDatastore(datastore, new Key(testPaths.replica)),
        manifest,
        blocks,
        access,
        identity,
        entry: createBasalEntry(),
        identityModule: createBasalIdentity()
      })
      await start(replica)
      keyvalue = storeModule.create({
        manifest,
        blocks,
        replica,
        datastore: new NamespaceDatastore(datastore, new Key(testPaths.store))
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
