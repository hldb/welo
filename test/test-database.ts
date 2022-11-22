import path from 'path'
import { strict as assert } from 'assert'
import { IPFS } from 'ipfs'

import { Database } from '~database/index.js'
import { Keyvalue, Keyvalue as Store } from '~store/keyvalue/index.js'
import {
  StaticAccess as Access,
  StaticAccess
} from '~access/static/index.js'
import { Entry } from '~entry/basal/index.js'
import { Identity } from '~identity/basal/index.js'
import { Manifest } from '~manifest/index.js'
import { initRegistry } from '~registry/index.js'
import { Blocks } from '~blocks/index.js'
import { defaultManifest } from '~utils/index.js'
import { LevelStorage, StorageFunc, StorageReturn } from '~storage/index.js'
import { MultiReplicator } from '~replicator/multi.js'

import { getTestPaths, tempPath } from './utils/constants.js'
import { getTestIpfs, offlineIpfsOptions } from './utils/ipfs.js'
import { getTestStorage, TestStorage } from './utils/persistence.js'
import { getTestIdentity } from './utils/identities.js'

const testName = 'database'

describe(testName, () => {
  let ipfs: IPFS,
    blocks: Blocks,
    storage: TestStorage,
    database: Database,
    manifest: Manifest,
    identity: Identity,
    directory: string,
    Storage: StorageFunc

  const registry = initRegistry()

  registry.store.add(Keyvalue)
  registry.access.add(StaticAccess)
  registry.entry.add(Entry)
  registry.identity.add(Identity)

  before(async () => {
    const testPaths = getTestPaths(tempPath, testName)
    ipfs = await getTestIpfs(testPaths, offlineIpfsOptions)
    blocks = new Blocks(ipfs)

    storage = await getTestStorage(testPaths)

    identity = await getTestIdentity(storage, testName)

    manifest = await Manifest.create({
      ...defaultManifest('name', identity, registry),
      access: {
        protocol: StaticAccess.protocol,
        config: { write: [identity.id] }
      }
    })

    directory = path.join(testPaths.test, manifest.address.toString())
    Storage = async (name: string): Promise<StorageReturn> => await LevelStorage(path.join(directory, name))
  })

  after(async () => {
    await storage.close()
    await ipfs.stop()
  })

  describe('class', () => {
    it('exposes static properties', () => {
      assert.ok(Database.open)
    })

    describe('open', () => {
      it('returns a new Database instance', async () => {
        database = await Database.open({
          directory,
          Storage,
          manifest,
          identity,
          blocks,
          Store,
          Access,
          Entry,
          Identity,
          Replicator: MultiReplicator // empty replicator
        })
      })
    })
  })

  describe('instance', () => {
    it('exposes instance properties', () => {
      assert.ok(database.blocks)
      assert.ok(database.identity)
      assert.ok(database.replica)
      assert.ok(database.manifest)
      assert.ok(database.store)
      assert.ok(database.access)
      assert.ok(database.Entry)
      assert.ok(database.Identity)
      // see about doing this with generics
      // assert.ok(database.put);
      // assert.ok(database.del);
      // assert.ok(database.get);
      assert.ok(database.events)
      assert.ok(database.close)
    })

    describe('close', () => {
      it('resets the database state', async () => {
        assert.equal(database.isStarted(), true)
        await database.close()
        assert.equal(database.isStarted(), false)
      })
    })
  })
})
