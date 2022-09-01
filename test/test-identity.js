
import { strict as assert } from 'assert'
import * as IPFS from 'ipfs'
import * as Block from 'multiformats/block'
import * as codec from '@ipld/dag-cbor'
import { sha256 as hasher } from 'multiformats/hashes/sha2'
import { base32 } from 'multiformats/bases/base32'

import { Identity } from '../src/manifest/identity/index.js'
import { KeyChain as Keychain } from '../src/keychain/index.js'

import { identity } from './fixtures/constants.js'

const { identityData, pem, storage: storageFunc } = identity
const storage = storageFunc()

const dataEmpty = new Uint8Array()
const signedEmpty = new Uint8Array([
  48,  68,   2,  32, 107, 228, 179,  41,  80, 238,  86,
 109, 104,  28,  89, 141, 163,  29, 194, 213, 247, 116,
 186, 230, 221, 203, 250, 106,  39, 251, 117, 240, 140,
 149, 135, 210,   2,  32, 118,  95, 176, 194,  18, 170,
  28,  89, 239,  17,  43, 117, 254,  87,  72, 245, 145,
  66, 180, 251, 131, 199,   9, 205, 170, 158,  84, 249,
 110, 164, 176,  95
])
const identityCID = 'bafyreiaxq34q3ylhpehhpwklmwlymqwb53bneufwboduhxtedx34sf47ga'

describe('Base Identity', () => {
  let ipfs, blocks, identities, keychain, identity, kpi
  let tempKeychain
  const expectedType = 'base'
  const name = 'test'
  const password = ''

  before(async () => {
    ipfs = await IPFS.create({ repo: './test/fixtures/ipfs' })
    blocks = ipfs.block // replace this with a local block store later

    await storage.identities.open()
    await storage.keychain.open()
    await storage.temp.identities.open()
    await storage.temp.keychain.open()

    identities = storage.identities
    keychain = new Keychain({ getDatastore: () => storage.keychain })
    tempKeychain = new Keychain({ getDatastore: () => storage.temp.keychain })

    const identityBlock = await Block.encode({ value: identityData, codec, hasher })
    const kpiData = { pem, identity: identityBlock.bytes }
    kpi = await Block.encode({ value: kpiData, codec, hasher })
    await Identity.import({
      name,
      identities,
      keychain,
      kpi: kpi.bytes,
      password
    }).catch(e => assert.equal(e.message, 'an identity with that name already exists; import failed'))
    await blocks.put(identityBlock.bytes)
  })

  after(async () => {
    await storage.identities.close()
    await storage.keychain.close()
    await storage.temp.identities.close()
    await storage.temp.keychain.close()

    await ipfs.stop()
  })

  describe('Class', () => {
    it('exposes static properties', () => {
      assert.ok(Identity.type)
      assert.ok(Identity.get)
      assert.ok(Identity.fetch)
      assert.ok(Identity.asIdentity)
      assert.ok(Identity.export)
      assert.ok(Identity.import)
      assert.ok(Identity.verify)
    })

    it(`.type is equal to '${expectedType}'`, () => {
      assert.equal(Identity.type, expectedType)
    })

    describe('.get', () => {
      it('grabs existing identity', async () => {
        identity = await Identity.get({ name, identities, keychain })
        assert.equal(identity.name, name)
        assert.equal(identity.block.cid.toString(base32), identityCID)
        assert.ok(identity instanceof Identity)
      })

      it('creates a new identity', async () => {
        const randomName = Math.random().toString()
        const _identity = await Identity.get({
          name: randomName,
          identities: storage.temp.identities,
          keychain: tempKeychain
        })
        assert.equal(_identity.name, randomName)
        assert.ok(_identity instanceof Identity)
      })

      // it('returns an existing instance of the identity', async () => {})
    })

    describe('.fetch', () => {
      it('fetches valid identity', async () => {
        const _identity = await Identity.fetch({ blocks, auth: identity.auth })
        assert.notEqual(_identity, identity)
        assert.equal(_identity.block.cid.toString(base32), identity.block.cid.toString(base32))
        assert.equal(_identity.pubkey._key.toString(), identity.pubkey._key.toString())
        assert.equal(_identity.name, undefined)
      })

      // it('throws fetching invalid identity', async () => {})
    })

    describe('.asIdentity', async () => {
      it('returns the same instance if possible', async () => {
        const _identity = await Identity.asIdentity(identity)
        assert.equal(_identity, identity)
        assert.equal(_identity.block.cid.toString(base32), identity.block.cid.toString(base32))
        assert.equal(_identity.pubkey._key.toString(), identity.pubkey._key.toString())
        assert.equal(_identity.name, name)
      })

      it('returns a new instance if needed', async () => {
        const _identity = await Identity.asIdentity({ block: identity.block })
        assert.notEqual(_identity, identity)
        assert.equal(_identity.block.cid.toString(base32), identity.block.cid.toString(base32))
        assert.equal(_identity.pubkey._key.toString(), identity.pubkey._key.toString())
        assert.equal(_identity.name, undefined)
      })
    })

    describe('.import and .export', async () => {
      let exported, exportedBlock, kpi
      const tempKeychain = new Keychain({ getDatastore: () => storage.temp.keychain })

      it('exports an encoded identity/keypair', async () => {
        exported = await Identity.export({ name, identities, keychain, password })
        exportedBlock = await Block.decode({ bytes: exported, codec, hasher })
        kpi = await Block.decode({ bytes: exportedBlock.value.identity, codec, hasher })
        assert.equal(exportedBlock.value.pem.length, 108)
        assert.deepEqual(kpi.cid, identity.auth)
      })

      it('imports an encoded identity/keypair', async () => {
        const name = Math.random().toString()
        await Identity.import({
          name,
          identities: storage.temp.identities,
          keychain: tempKeychain,
          kpi: exported,
          password
        })
        const identity = await Identity.get({
          name,
          identities: storage.temp.identities,
          keychain: tempKeychain
        })
        assert.ok(await tempKeychain.exportKey(name, password))
        assert.deepEqual(identity.block.cid, kpi.cid)
      })
    })

    describe('.sign', () => {
      it('signs an empty byte array', async () => {
        const data = dataEmpty
        const sig = await Identity.sign({ identity, data })
        assert.ok(sig instanceof Uint8Array)
        assert.equal(sig.toString(), signedEmpty.toString())
      })
    })

    describe('.verify', () => {
      it('verifies a valid signature', async () => {
        const data = dataEmpty
        const sig = signedEmpty
        const verified = await Identity.verify({ identity, data, sig })
        assert.equal(verified, true)
      })

      it('unverifies an invalid signature', async () => {
        const data = new Uint8Array([1])
        const sig = signedEmpty
        const verified = await Identity.verify({ identity, data, sig })
        assert.equal(verified, false)
      })
    })
  })

  describe('Instance', () => {
    it('exposes instance properties', async () => {
      assert.ok(identity.name)
      assert.ok(identity.block)
      assert.ok(identity.pubkey)
      assert.ok(identity.sign)
      assert.ok(identity.verify)
      assert.ok(identity.auth)
      assert.ok(identity.id)
      assert.ok(identity.pub)
      assert.ok(identity.sig)
      assert.equal(identity.auth, identity.block.cid)
      assert.equal(identity.id, identity.block.value.id)
      assert.equal(identity.pub, identity.block.value.pub)
      assert.equal(identity.sig, identity.block.value.sig)
      assert.ok(identity.id instanceof Uint8Array)
      assert.ok(identity.pub instanceof Uint8Array)
      assert.ok(identity.sig instanceof Uint8Array)
      assert.ok(await identity.verify(identity.pub, identity.sig))
    })

    describe('.sign', () => {
      it('signs an empty byte array', async () => {
        const data = dataEmpty
        const sig = await identity.sign(data)
        assert.ok(sig instanceof Uint8Array)
        assert.deepEqual(sig, signedEmpty)
      })
    })

    describe('.verify', () => {
      it('verifies a valid signature', async () => {
        const data = dataEmpty
        const sig = signedEmpty
        const verified = await identity.verify(data, sig)
        assert.equal(verified, true)
      })

      it('unverifies an invalid signature', async () => {
        const data = new Uint8Array([1])
        const sig = signedEmpty
        const verified = await identity.verify(data, sig)
        assert.equal(verified, false)
      })
    })
  })
})
