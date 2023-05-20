import { assert } from './utils/chai.js'
import type { Helia } from '@helia/interface'
import type { Libp2p } from 'libp2p'

import { Welo } from '../src/index.js'
import type { Welo as WeloType } from '../src/welo.js'
import { WELO_PATH } from '~/utils/constants.js'
import type { Address, Manifest } from '~/manifest/index.js'
import type { Database } from '../src/database.js'
import type { Identity } from '~/identity/basal/index.js'

import { getTestPaths, names, tempPath } from './utils/constants.js'
import { getTestIpfs, offlineIpfsOptions } from './utils/ipfs.js'
import { getTestIdentities, getTestIdentity } from './utils/identities.js'
import { getTestLibp2p } from './utils/libp2p.js'

const testName = 'welo'

describe(testName, () => {
  let ipfs: Helia,
    libp2p: Libp2p,
    welo: WeloType,
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

    directory = testPaths.test + WELO_PATH
    directory1 = directory + '1'
  })

  after(async () => {
    await welo.stop()
    await ipfs.stop()
  })

  describe('class', () => {
    it('exposes static properties', () => {
      assert.isOk(Welo.registry.access)
      assert.isOk(Welo.registry.entry)
      assert.isOk(Welo.registry.identity)
      assert.isOk(Welo.registry.store)
      assert.isOk(Welo.Datastore)
      // assert.isOk(Welo.Replicator)
      assert.isOk(Welo.create)
    })

    describe('create', () => {
      it('returns an instance of Welo', async () => {
        welo = await Welo.create({ ipfs, libp2p, directory })
      })

      it('returns an instance of Welo with an identity option', async () => {
        const directory = directory1
        const welo = await Welo.create({ ipfs, libp2p, directory, identity })
        await welo.stop()
      })

      it('rejects if no identity option or Welo.Datastore', async () => {
        const Datastore = Welo.Datastore
        Welo.Datastore = undefined

        const promise = Welo.create({ ipfs, libp2p, directory })
        await assert.isRejected(promise)

        Welo.Datastore = Datastore
      })
    })
  })

  describe('instance', () => {
    let manifest: Manifest, address: Address

    it('exposes instance properties', () => {
      assert.isOk(welo.stop)
      assert.isOk(welo.determine)
      assert.isOk(welo.fetch)
      assert.isOk(welo.open)
    })

    describe('determineManifest', () => {
      it('returns an instance of Manifest based on some options', async () => {
        manifest = await welo.determine({ name: 'test' })
        address = manifest.address
      })
    })

    describe('fetchManifest', () => {
      it('returns an instance of Manifest from a manifest address', async () => {
        const _manifest = await welo.fetch(address)
        assert.deepEqual(_manifest.block.cid, manifest.block.cid)
      })
    })

    describe('open', () => {
      let database: Database

      it('returns an instance of Database for a manifest', async () => {
        const promise = welo.open(manifest)
        assert.strictEqual(welo.opened.size, 0)
        database = await promise
        assert.strictEqual(welo.opened.size, 1)
      })

      it('rejects when opening a database already open', async () => {
        const promise = welo.open(manifest)
        await assert.isRejected(promise)
      })

      it('handles database.close events', async () => {
        assert.strictEqual(welo.opened.size, 1)
        await database.close()
        assert.strictEqual(welo.opened.size, 0)
      })
    })
  })
})
