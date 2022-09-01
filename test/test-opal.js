
import { strict as assert } from 'assert'
import * as IPFS from 'ipfs'

import { Opal } from '../src/index.js'

describe('Opal', () => {
  let ipfs, opal

  before(async () => {
    ipfs = await IPFS.create()
  })

  after(async () => {
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
      assert.ok(Opal.Replicator)
      assert.ok(Opal.create)
      assert.ok(Opal.Manifest)
    })

    describe('create', () => {
      it('returns an instance of Opal', async () => {
        opal = await Opal.create({ ipfs })
      })
    })
  })

  describe('instance', () => {
    let manifest, address

    it('exposes instance properties', () => {
      assert.ok(opal.stop)
      assert.ok(opal.determineManifest)
      assert.ok(opal.fetchManifest)
      assert.ok(opal.open)
    })

    describe('determineManifest', () => {
      it('returns an instance of Manifest based on some options', async () => {
        manifest = await opal.determineManifest('test')
        address = manifest.address
      })
    })

    describe('fetchManifest', () => {
      it('returns an instance of Manifest from a manifest address', async () => {
        const _manifest = await opal.fetchManifest(address)
        assert.deepEqual(_manifest, manifest)
      })
    })

    describe('open', () => {
      it('returns an instance of Database for a manifest', async () => {
        await opal.open(manifest)
      })
    })
  })
})
