import { strict as assert } from 'assert'
import { start, stop } from '@libp2p/interfaces/startable'
import { LevelDatastore } from 'datastore-level'
import type { IPFS } from 'ipfs-core-types'

import { Keyvalue } from '~store/keyvalue/index.js'
import { Replica } from '~database/replica.js'
import { Blocks } from '~blocks/index.js'
import { StaticAccess } from '~access/static/index.js'
import { Entry } from '~entry/basal/index.js'
import { Identity } from '~identity/basal/index.js'
import { initRegistry } from '../src/registry.js'
import { Manifest } from '~manifest/index.js'
import { defaultManifest } from '~utils/index.js'

import { getTestPaths, names, tempPath, TestPaths } from './utils/constants.js'
import { getTestIpfs, offlineIpfsOptions } from './utils/ipfs.js'
import { getTestIdentities, getTestIdentity } from './utils/identities.js'
import { getTestLibp2p } from './utils/libp2p.js'

const testName = 'keyvalue'

describe(testName, () => {
  let ipfs: IPFS, blocks: Blocks, identity: Identity, testPaths: TestPaths
  const expectedProtocol = '/opal/store/keyvalue'
  const Datastore = LevelDatastore

  const registry = initRegistry()

  registry.store.add(Keyvalue)
  registry.access.add(StaticAccess)
  registry.entry.add(Entry)
  registry.identity.add(Identity)

  before(async () => {
    testPaths = getTestPaths(tempPath, testName)
    ipfs = await getTestIpfs(testPaths, offlineIpfsOptions)
    blocks = new Blocks(ipfs)

    const identities = await getTestIdentities(testPaths)
    const libp2p = await getTestLibp2p(ipfs)
    const keychain = libp2p.keychain

    identity = await getTestIdentity(identities, keychain, names.name0)

    await blocks.put(identity.block)
  })

  after(async () => {
    await ipfs.stop()
  })

  describe('class', () => {
    it('exposes static properties', () => {
      assert.ok(Keyvalue)
      assert.equal(Keyvalue.protocol, expectedProtocol)
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
        ...defaultManifest('name', identity, registry),
        access: {
          protocol: StaticAccess.protocol,
          config: { write: [identity.id] }
        }
      })
      access = new StaticAccess({ manifest })
      await start(access)
      replica = new Replica({
        Datastore,
        manifest,
        directory: testPaths.replica,
        blocks,
        access,
        identity,
        Entry,
        Identity
      })
      await start(replica)
      keyvalue = new Keyvalue({
        manifest,
        directory: testPaths.store,
        blocks,
        replica,
        Datastore
      })
      await start(keyvalue)
    })

    after(async () => {
      await stop(keyvalue)
      await stop(replica)
    })

    it('exposes instance properties', () => {
      assert.ok(keyvalue.start)
      assert.ok(keyvalue.stop)
      // assert.ok(keyvalue.events)
      assert.ok(keyvalue.index)
      assert.ok(keyvalue.creators)
      assert.ok(keyvalue.selectors)
      assert.ok(keyvalue.latest)
    })

    describe('update', () => {
      it('sets a key value pair to value', async () => {
        const payload = keyvalue.creators.put(key, value)
        const entry = await replica.write(payload)

        const index = await keyvalue.latest()

        assert.deepEqual(entry.payload, payload)
        assert.equal(await keyvalue.selectors.get(index)(key), value)
      })

      it('deletes a key value pair', async () => {
        const payload = keyvalue.creators.del(key)
        const entry = await replica.write(payload)

        const index = await keyvalue.latest()

        assert.deepEqual(entry.payload, payload)
        assert.equal(await keyvalue.selectors.get(index)(key), undefined)
      })

      it('updates a key value pair to new value', async () => {
        const payload = keyvalue.creators.put(key, value + 1)
        const entry = await replica.write(payload)

        const index = await keyvalue.latest()

        assert.deepEqual(entry.payload, payload)
        assert.equal(await keyvalue.selectors.get(index)(key), value + 1)
      })
    })

    describe('reading persisted state', () => {
      it('can read persisted keyvalue state', async () => {
        await stop(keyvalue)
        await start(keyvalue)

        const index = keyvalue.index

        assert.equal(await keyvalue.selectors.get(index)(key), value + 1)
      })
    })
  })
})
