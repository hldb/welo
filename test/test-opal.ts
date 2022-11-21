import { strict as assert } from 'assert'
import type { IPFS } from 'ipfs'

import { Opal } from '~src/index.js'
import { Opal as OpalType } from '~src/opal.js'
import { OPAL_PREFIX } from '~utils/constants.js'
import type { Address, Manifest } from '~manifest/index.js'
import { Database } from '~database/index.js'

import { getIpfs, constants, getIdentity } from './utils/index.js'

const getDirectory = (): string =>
  constants.temp.path + '/test-opal' + OPAL_PREFIX + String(Math.random())
describe('Opal', () => {
  let ipfs: IPFS, opal: OpalType

  before(async () => {
    ipfs = await getIpfs()
  })

  after(async () => {
    await opal.stop()
    await ipfs.stop()
  })

  describe('class', () => {
    it('exposes static properties', () => {
      assert.ok(Opal.registry.access)
      assert.ok(Opal.registry.entry)
      assert.ok(Opal.registry.identity)
      assert.ok(Opal.registry.store)
      assert.ok(Opal.Storage)
      assert.ok(Opal.Keychain)
      // assert.ok(Opal.Replicator)
      assert.ok(Opal.create)
      assert.ok(Opal.Manifest)
    })

    describe('create', () => {
      it('returns an instance of Opal', async () => {
        const directory = getDirectory()

        opal = await Opal.create({ ipfs, directory })
      })

      it('returns an instance of Opal with an identity option', async () => {
        const directory = getDirectory()
        const got = await getIdentity()
        await got.storage.close()
        const identity = got.identity

        await Opal.create({ ipfs, directory, identity })
      })

      it('rejects if no identity option or Opal.Storage', async () => {
        const Storage = Opal.Storage
        Opal.Storage = undefined
        const directory = getDirectory()

        const promise = Opal.create({ ipfs, directory })
        await assert.rejects(promise)

        Opal.Storage = Storage
      })

      it('rejects if no identity option or Opal.Keychain', async () => {
        const Keychain = Opal.Keychain
        Opal.Keychain = undefined
        const directory = getDirectory()

        const promise = Opal.create({ ipfs, directory })
        await assert.rejects(promise)

        Opal.Keychain = Keychain
      })
    })
  })

  describe('instance', () => {
    let manifest: Manifest, address: Address

    it('exposes instance properties', () => {
      assert.ok(opal.stop)
      assert.ok(opal.determine)
      assert.ok(opal.fetch)
      assert.ok(opal.open)
    })

    describe('determineManifest', () => {
      it('returns an instance of Manifest based on some options', async () => {
        manifest = await opal.determine({ name: 'test' })
        address = manifest.address
      })
    })

    describe('fetchManifest', () => {
      it('returns an instance of Manifest from a manifest address', async () => {
        const _manifest = await opal.fetch(address)
        assert.deepEqual(_manifest.block.cid, manifest.block.cid)
      })
    })

    describe('open', () => {
      let database: Database

      it('returns an instance of Database for a manifest', async () => {
        const promise = opal.open(manifest)
        assert.equal(opal.opened.size, 0)
        database = await promise
        assert.equal(opal.opened.size, 1)
      })

      it('rejects when opening a database already open', async () => {
        const promise = opal.open(manifest)
        await assert.rejects(promise)
      })

      it('handles database.close events', async () => {
        assert.equal(opal.opened.size, 1)
        await database.close()
        assert.equal(opal.opened.size, 0)
      })
    })
  })
})
