
import { strict as assert } from 'assert'

import { Database } from '../src/database/index.js'

import { Keyvalue as Store } from '../src/manifest/store/keyvalue.js'
import { StaticAccess as Access } from '../src/manifest/access/static.js'
import { Entry } from '../src/manifest/entry/index.js'
import { Identity } from '../src/manifest/identity/index.js'

import { getIpfs, getIdentity, writeManifest } from './utils/index.js'

describe('Database', () => {
  let ipfs, blocks, storage, database, manifest, identity

  before(async () => {
    ipfs = await getIpfs()
    blocks = ipfs.block

    const obj = await getIdentity()

    storage = obj.storage
    identity = obj.identity

    manifest = await writeManifest({ access: { write: [identity.id] } })
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
        const options = {}
        database = await Database.open({ manifest, identity, blocks, Store, Access, Entry, Identity, options })
      })
    })
  })

  describe('instance', () => {
    it('exposes instance properties', () => {
      assert.ok(database.blocks)
      assert.ok(database.options)
      assert.ok(database.identity)
      assert.ok(database.replica)
      assert.ok(database.manifest)
      assert.ok(database.store)
      assert.ok(database.access)
      assert.ok(database.Entry)
      assert.ok(database.Identity)
      assert.ok(database.put)
      assert.ok(database.del)
      assert.ok(database.get)
      assert.ok(database.events)
      assert.ok(database.open)
      assert.ok(database.close)
    })

    describe('close', () => {
      it('resets the database state', async () => {
        await database.close()
        assert.equal(database.open, false)
      })
    })
  })
})
