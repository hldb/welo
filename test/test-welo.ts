import { assert, expect } from 'aegir/chai'
import type { Components } from '@/interface'

import { createWelo, type Welo } from '@/welo.js'
import type { Address, Manifest } from '@/manifest/index.js'
import type { Database } from '@/database.js'
import { staticAccess } from '@/access/static/index.js'
import { basalEntry } from '@/entry/basal/index.js'
import { Identity, basalIdentity } from '@/identity/basal/index.js'
import { keyvalueStore } from '@/store/keyvalue/index.js'

import { getTestPaths, names, tempPath } from './utils/constants.js'
import { getTestIdentities, getTestIdentity } from './utils/identities.js'
import type { UsedServices } from './utils/libp2p/services.js'
import type { Helia } from '@helia/interface'
import { createLibp2p, type Libp2p } from 'libp2p'
import { getLibp2pDefaults } from './utils/libp2p/defaults.js'
import { createHelia } from 'helia'

const testName = 'welo'

type TestServices = UsedServices<'identify' | 'pubsub'>

describe(testName, () => {
  let
    helia: Helia<Libp2p<TestServices>>,
    libp2p: Libp2p<TestServices>,
    welo: Welo,
    identity: Identity,
    components: Components

  before(async () => {
    const testPaths = getTestPaths(tempPath, testName)

    libp2p = await createLibp2p<TestServices>(await getLibp2pDefaults())
    helia = await createHelia({ libp2p })

    const identities = await getTestIdentities(testPaths)
    const keychain = libp2p.keychain

    components = {
      store: [keyvalueStore()],
      identity: [basalIdentity()],
      entry: [basalEntry()],
      access: [staticAccess()]
    }

    identity = await getTestIdentity(identities, keychain, names.name0)
  })

  after(async () => {
    await welo.stop()
    await helia.stop()
  })

  describe('createWelo', () => {
    it('returns an instance of Welo', async () => {
      welo = await createWelo({ ipfs: helia, components })
    })

    it('returns an instance of Welo with an identity option', async () => {
      const welo = await createWelo({ ipfs: helia, identity })
      assert.strictEqual(welo.identity, identity)
      await welo.stop()
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
        await expect(promise).to.eventually.be.rejected()
      })

      it('handles database.close events', async () => {
        assert.strictEqual(welo.opened.size, 1)
        await database.close()
        assert.strictEqual(welo.opened.size, 0)
      })
    })

    describe('getComponents', () => {
      it('returns the components for the manifest', () => {
        const localComponents = welo.getComponents(manifest)
        assert.strictEqual(localComponents.store, components.store[0])
        assert.strictEqual(localComponents.access, components.access[0])
        assert.strictEqual(localComponents.entry, components.entry[0])
        assert.strictEqual(localComponents.identity, components.identity[0])
      })
    })
  })
})
