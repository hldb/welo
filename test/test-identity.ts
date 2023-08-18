import { assert, expect } from 'aegir/chai'
import type { PublicKey } from '@libp2p/interface/keys'
import { base32 } from 'multiformats/bases/base32'
import type { Datastore } from 'interface-datastore'
import type { KeyChain } from '@libp2p/interface/keychain'

import { Identity, basalIdentity } from '@/identity/basal/index.js'

import { fixtPath, getTestPaths, names, tempPath } from './utils/constants.js'
import { getTestIdentities, kpi } from './utils/identities.js'
import type { Blockstore } from 'interface-blockstore'
import { getLibp2pDefaults } from './utils/libp2p/defaults.js'
import { getNonVolatileStorage } from './utils/storage.js'
import { createLibp2p } from 'libp2p'

const testName = 'basal identity'

describe(testName, () => {
  let
    blockstore: Blockstore,
    identities: Datastore,
    keychain: KeyChain,
    identity: Identity,
    tempIdentities: Datastore,
    tempKeychain: KeyChain

  const expectedProtocol = '/hldb/identity/basal'
  const name = names.name0
  const password = ''
  const identityModule = basalIdentity()

  const dataEmpty = new Uint8Array()
  const signedEmpty = base32.decode(
    'bgbcqeiiayc2skoa4am3u3kmq4io6zjspbroxyfw2duj2lzxagrxfoafes4eaeid3eayxiin7neu6s4jhngwj2uoxoxxhzrdcckhtinpqtugc64tyze'
  )
  const authstring =
    'bafyreibvk33g3t2jktm3i7q7vwugu3mqoc3oajlymb7u46qn6kqpsexl4u'

  before(async () => {
    const fixtTestPaths = getTestPaths(fixtPath, testName)

    const storage = await getNonVolatileStorage(fixtTestPaths.ipfs)
    const datastore = storage.datastore
    blockstore = storage.blockstore

    const libp2p = await createLibp2p({
      ...(await getLibp2pDefaults()),
      datastore
    })
    keychain = libp2p.keychain

    identities = await getTestIdentities(fixtTestPaths)
    identity = await identityModule.import({
      name,
      identities,
      keychain,
      kpi
    }).catch(async () => await identityModule.get({ name, identities, keychain }))

    const tempTestPaths = getTestPaths(tempPath, testName)
    const tempLibp2p = await createLibp2p(await getLibp2pDefaults())

    tempIdentities = await getTestIdentities(tempTestPaths)
    tempKeychain = tempLibp2p.keychain
  })

  describe('Class', () => {
    it('exposes static properties', () => {
      assert.isOk(identityModule.protocol)
      assert.isOk(identityModule.get)
      assert.isOk(identityModule.fetch)
      assert.isOk(identityModule.asIdentity)
      assert.isOk(identityModule.export)
      assert.isOk(identityModule.import)
      assert.isOk(identityModule.verify)
    })

    it(`.type is equal to '${expectedProtocol}'`, () => {
      assert.strictEqual(identityModule.protocol, expectedProtocol)
    })

    describe('.get', () => {
      it('grabs existing identity', async () => {
        identity = await identityModule.get({ name, identities, keychain })
        assert.strictEqual(identity.name, name)
        assert.strictEqual(identity.block.cid.toString(base32), authstring)
        assert.isOk(identity instanceof Identity)
      })

      it('creates a new identity', async () => {
        const randomName = Math.random().toString()
        const _identity = await identityModule.get({
          name: randomName,
          identities: tempIdentities,
          keychain: tempKeychain
        })
        assert.strictEqual(_identity.name, randomName)
        assert.isOk(_identity instanceof Identity)
      })

      // it('returns an existing instance of the identity', async () => {})
    })

    describe('.fetch', () => {
      it('fetches valid identity', async () => {
        await blockstore.put(identity.block.cid, identity.block.bytes)
        const _identity = await identityModule.fetch({ blockstore, auth: identity.auth })
        assert.notStrictEqual(_identity, identity)
        assert.strictEqual(
          _identity.block.cid.toString(base32),
          identity.block.cid.toString(base32)
        )
        assert.strictEqual(_identity.pubkey.equals(identity.pubkey), true)
        assert.strictEqual(_identity.name, undefined)
      })

      // it('throws fetching invalid identity', async () => {})
    })

    describe('.asIdentity', () => {
      it('returns the same instance if possible', async () => {
        const _identity = (identityModule.asIdentity(identity)) as Identity
        assert.strictEqual(_identity, identity)
        assert.strictEqual(
          _identity.block.cid.toString(base32),
          identity.block.cid.toString(base32)
        )
        assert.strictEqual(_identity.pubkey.equals(identity.pubkey), true)
        assert.strictEqual(_identity.name, name)
      })

      it('returns a new instance if needed', async () => {
        const _identity = (identityModule.asIdentity({
          block: identity.block
        })) as Identity
        assert.notStrictEqual(_identity, identity)
        assert.strictEqual(
          _identity.block.cid.toString(base32),
          identity.block.cid.toString(base32)
        )
        assert.strictEqual(_identity.pubkey.equals(identity.pubkey), true)
        assert.strictEqual(_identity.name, undefined)
      })
    })

    describe('.import and .export', () => {
      it('imports an encoded identity/keypair', async () => {
        const name = names.name1
        const imported = await identityModule.import({
          name,
          identities: tempIdentities,
          keychain: tempKeychain,
          kpi
        })

        assert.isOk(await tempKeychain.exportKey(name, password))
        assert.deepEqual(
          imported.auth.toString(base32),
          identity.auth.toString(base32)
        )
        assert.isOk(imported instanceof Identity)
      })

      it('rejects importing to an existing identity', async () => {
        const name = names.name1
        const promise = identityModule.import({
          name,
          identities: tempIdentities,
          keychain: tempKeychain,
          kpi
        })

        await expect(promise).to.eventually.be.rejected()
      })

      it('exports an encoded identity/keypair', async () => {
        const name = names.name1
        const exported = await identityModule.export({
          name,
          identities: tempIdentities,
          keychain: tempKeychain
        })

        assert.deepEqual(new Uint8Array(exported), new Uint8Array(exported))
      })

      it('rejects exporting a non-existant identity', async () => {
        const name = names.name2
        const promise = identityModule.export({
          name,
          identities: tempIdentities,
          keychain: tempKeychain
        })

        await expect(promise).to.eventually.be.rejected()
      })
    })

    describe('.sign', () => {
      it('signs an empty byte array', async () => {
        const data = dataEmpty
        const sig = await identityModule.sign(identity, data)
        assert.isOk(sig instanceof Uint8Array)
        assert.strictEqual(sig.toString(), signedEmpty.toString())
      })
    })

    describe('.verify', () => {
      it('verifies a valid signature', async () => {
        const data = dataEmpty
        const sig = signedEmpty
        const verified = await identityModule.verify(identity, data, sig)
        assert.strictEqual(verified, true)
      })

      it('unverifies an invalid signature', async () => {
        const data = new Uint8Array([1])
        const sig = signedEmpty
        const verified = await identityModule.verify(identity, data, sig)
        assert.strictEqual(verified, false)
      })

      it('rejects verifying signatures without a pubkey', async () => {
        const _identity = (identityModule.asIdentity({
          block: identity.block
        })) as Identity
        _identity.pubkey = undefined as unknown as PublicKey

        const data = new Uint8Array([1])
        const sig = signedEmpty
        const promise = identityModule.verify(_identity, data, sig)
        await expect(promise).to.eventually.be.rejected()
      })
    })
  })

  describe('Instance', () => {
    it('exposes instance properties', async () => {
      assert.isOk(identity.name)
      assert.isOk(identity.block)
      assert.isOk(identity.pubkey)
      assert.isOk(identity.sign)
      assert.isOk(identity.verify)
      assert.isOk(identity.auth)
      assert.isOk(identity.id)
      assert.isOk(identity.pub)
      assert.isOk(identity.sig)
      assert.strictEqual(identity.auth, identity.block.cid)
      assert.strictEqual(identity.id, identity.block.value.id)
      assert.strictEqual(identity.pub, identity.block.value.pub)
      assert.strictEqual(identity.sig, identity.block.value.sig)
      assert.isOk(identity.id instanceof Uint8Array)
      assert.isOk(identity.pub instanceof Uint8Array)
      assert.isOk(identity.sig instanceof Uint8Array)
      assert.isOk(await identity.verify(identity.pub, identity.sig))
    })

    describe('.sign', () => {
      it('signs an empty byte array', async () => {
        const data = dataEmpty
        const sig = await identity.sign(data)
        assert.isOk(sig instanceof Uint8Array)
        assert.deepEqual(sig, signedEmpty)
      })

      it('rejects signing data without private key', async () => {
        const _identity = (identityModule.asIdentity({
          block: identity.block
        })) as Identity
        const data = dataEmpty
        const promise = _identity.sign(data)
        await expect(promise).to.eventually.be.rejected()
      })
    })

    describe('.verify', () => {
      it('verifies a valid signature', async () => {
        const data = dataEmpty
        const sig = signedEmpty
        const verified = await identity.verify(data, sig)
        assert.strictEqual(verified, true)
      })

      it('unverifies an invalid signature', async () => {
        const data = new Uint8Array([1])
        const sig = signedEmpty
        const verified = await identity.verify(data, sig)
        assert.strictEqual(verified, false)
      })
    })
  })
})
