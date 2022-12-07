import { strict as assert } from 'assert'
import type { IPFS } from 'ipfs-core-types'
import type { Libp2p } from 'libp2p'

import { Opal } from '../src/index.js'
import type { Opal as OpalType } from '../src/opal.js'
import { OPAL_PATH } from '~utils/constants.js'
import type { Address, Manifest } from '~manifest/index.js'
import type { Database } from '../src/database.js'
import type { Identity } from '~identity/basal/index.js'

import { getTestPaths, names, tempPath } from './utils/constants.js'
import { getTestIpfs, offlineIpfsOptions } from './utils/ipfs.js'
import { getTestIdentities, getTestIdentity } from './utils/identities.js'
import { getTestLibp2p } from './utils/libp2p.js'

const testName = 'opal'

describe(testName, () => {
  let ipfs: IPFS,
    libp2p: Libp2p,
    opal: OpalType,
    directory: string,
    identity: Identity,
    directory1: string

  before(async () => {
    const testPaths = getTestPaths(tempPath, testName)
    ipfs = await getTestIpfs(testPaths, offlineIpfsOptions)

    const identities = await getTestIdentities(testPaths)
    libp2p = await getTestLibp2p(ipfs)
    const keychain = libp2p.keychain

    identity = await getTestIdentity(identities, keychain, names.name0)

    directory = testPaths.test + OPAL_PATH
    directory1 = directory + '1'
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
      assert.ok(Opal.Datastore)
      // assert.ok(Opal.Replicator)
      assert.ok(Opal.create)
      assert.ok(Opal.Manifest)
    })

    describe('create', () => {
      it('returns an instance of Opal', async () => {
        opal = await Opal.create({ ipfs, libp2p, directory })
      })

      it('returns an instance of Opal with an identity option', async () => {
        const directory = directory1
        const opal = await Opal.create({ ipfs, libp2p, directory, identity })
        await opal.stop()
      })

      it('rejects if no identity option or Opal.Datastore', async () => {
        const Datastore = Opal.Datastore
        Opal.Datastore = undefined

        const promise = Opal.create({ ipfs, libp2p, directory })
        await assert.rejects(promise)

        Opal.Datastore = Datastore
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
