import { assert } from './utils/chai.js'
import type { GossipHelia, GossipLibp2p } from '@/interface'

import createWelo from '@/utils/createDefaultWelo.js'
import { Welo } from '../src/welo.js'
import { WELO_PATH } from '@/utils/constants.js'
import type { Address, Manifest } from '@/manifest/index.js'
import type { Database } from '../src/database.js'
import { createStaticAccess } from '@/access/static/index.js'
import { Entry } from '@/entry/basal/index.js'
import { Identity } from '@/identity/basal/index.js'
import { Keyvalue } from '@/store/keyvalue/index.js'

import { getTestPaths, names, tempPath } from './utils/constants.js'
import { getTestIpfs, offlineIpfsOptions } from './utils/ipfs.js'
import { getTestIdentities, getTestIdentity } from './utils/identities.js'
import { getTestLibp2p } from './utils/libp2p.js'

const testName = 'welo'

describe(testName, () => {
  let ipfs: GossipHelia,
    libp2p: GossipLibp2p,
    welo: Welo,
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
      // assert.isOk(Welo.Replicator)
      assert.isOk(Welo.create)
    })

    describe('create', () => {
      it('returns an instance of Welo', async () => {
        welo = await createWelo({ ipfs, directory })
      })

      it('returns an instance of Welo with an identity option', async () => {
        const directory = directory1
        const welo = await createWelo({ ipfs, directory, identity })
        await welo.stop()
      })

      it.skip('rejects if no identity option or Welo.Datastore', async () => {
        const promise = createWelo({ ipfs, directory })
        await assert.isRejected(promise)
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
      assert.isOk(welo.getComponents)
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

    describe.skip('getComponents', () => {
      it('returns the components for the manifest', () => {
        const components = welo.getComponents(manifest)
        assert.strictEqual(components.Store, Keyvalue)
        assert.strictEqual(components.Access, createStaticAccess())
        assert.strictEqual(components.Entry, Entry)
        assert.strictEqual(components.Identity, Identity)
      })
    })
  })
})
