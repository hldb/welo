import path from 'path'
import { strict as assert } from 'assert'
import { IPFS } from 'ipfs'

import { Database } from '../src/database/index.js'

import { Keyvalue, Keyvalue as Store } from '../src/store/keyvalue/index.js'
import {
  StaticAccess as Access,
  StaticAccess
} from '../src/access/static/index.js'
import { Entry } from '../src/entry/default/index.js'
import { Identity } from '../src/identity/default/index.js'
import { Manifest } from '../src/manifest/default/index.js'
import { initRegistry } from '../src/registry/index.js'
import { Blocks } from '../src/mods/blocks.js'
import { defaultManifest } from '../src/utils/index.js'
import { getIpfs, getIdentity, getStorageReturn } from './utils/index.js'
import { LevelStorage, StorageFunc, StorageReturn } from '../src/mods/storage.js'
import { tempPath } from './utils/constants.js'

const registry = initRegistry()

registry.store.add(Keyvalue)
registry.access.add(StaticAccess)
registry.entry.add(Entry)
registry.identity.add(Identity)

describe('Database', () => {
  let ipfs: IPFS,
    blocks: Blocks,
    storage: getStorageReturn,
    database: Database,
    manifest: Manifest,
    identity: Identity,
    directory: string,
    Storage: StorageFunc

  before(async () => {
    ipfs = await getIpfs()
    blocks = new Blocks(ipfs)

    const obj = await getIdentity()

    storage = obj.storage
    identity = obj.identity

    manifest = await Manifest.create({
      ...defaultManifest('name', identity, registry),
      access: { protocol: StaticAccess.protocol, config: { write: [identity.id] } }
    })
    directory = path.join(tempPath, 'test-database', manifest.address.toString())
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
          Identity
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
