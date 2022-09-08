import { strict as assert } from 'assert'
import { IPFS } from 'ipfs'
import { base32 } from 'multiformats/bases/base32'
import { Keychain } from '../src/mods/keychain/index.js'
import { StorageReturn } from '../src/mods/storage.js'

import { Blocks } from '../src/mods/blocks.js'
import { Identity } from '../src/manifest/identity/index.js'

import {
  getIpfs,
  getIdentity,
  kpi,
  constants,
  getStorageReturn,
  getStorage
} from './utils/index.js'
import { PublicKey } from 'libp2p-crypto'
const { fixt, names } = constants

const dataEmpty = new Uint8Array()
const signedEmpty = base32.decode(
  'bgbcqeiiayc2skoa4am3u3kmq4io6zjspbroxyfw2duj2lzxagrxfoafes4eaeid3eayxiin7neu6s4jhngwj2uoxoxxhzrdcckhtinpqtugc64tyze'
)
const authstring = 'bafyreibvk33g3t2jktm3i7q7vwugu3mqoc3oajlymb7u46qn6kqpsexl4u'

describe('Base Identity', () => {
  let ipfs: IPFS,
    blocks: Blocks,
    storage: getStorageReturn,
    identities: StorageReturn,
    keychain: Keychain,
    identity: Identity
  let tempStorage: getStorageReturn,
    tempIdentities: StorageReturn,
    tempKeychain: Keychain
  const expectedType = 'base'
  const name = names.name0
  const password = ''

  before(async () => {
    ipfs = await getIpfs(fixt.identity)
    blocks = new Blocks(ipfs)

    storage = await getStorage(fixt.identity)
    identities = storage.identities
    keychain = new Keychain(storage.keychain)

    identity = await Identity.import({
      name,
      identities,
      keychain,
      kpi
    }).catch(async () => await Identity.get({ name, identities, keychain }))

    const gotTemp = await getIdentity()
    tempStorage = gotTemp.storage
    tempIdentities = tempStorage.identities
    tempKeychain = gotTemp.keychain
  })

  after(async () => {
    await storage.close()
    await tempStorage.close()
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
        assert.equal(identity.block.cid.toString(base32), authstring)
        assert.ok(identity instanceof Identity)
      })

      it('creates a new identity', async () => {
        const randomName = Math.random().toString()
        const _identity = await Identity.get({
          name: randomName,
          identities: tempIdentities,
          keychain: tempKeychain
        })
        assert.equal(_identity.name, randomName)
        assert.ok(_identity instanceof Identity)
      })

      // it('returns an existing instance of the identity', async () => {})
    })

    describe('.fetch', () => {
      it('fetches valid identity', async () => {
        await blocks.put(identity.block)
        const _identity = await Identity.fetch({ blocks, auth: identity.auth })
        assert.notEqual(_identity, identity)
        assert.equal(
          _identity.block.cid.toString(base32),
          identity.block.cid.toString(base32)
        )
        assert.equal(_identity.pubkey.equals(identity.pubkey), true)
        assert.equal(_identity.name, undefined)
      })

      // it('throws fetching invalid identity', async () => {})
    })

    describe('.asIdentity', () => {
      it('returns the same instance if possible', async () => {
        const _identity = await Identity.asIdentity(identity)
        assert.equal(_identity, identity)
        assert.equal(
          _identity.block.cid.toString(base32),
          identity.block.cid.toString(base32)
        )
        assert.equal(_identity.pubkey.equals(identity.pubkey), true)
        assert.equal(_identity.name, name)
      })

      it('returns a new instance if needed', async () => {
        const _identity = (await Identity.asIdentity({
          block: identity.block
        })) as Identity
        assert.notEqual(_identity, identity)
        assert.equal(
          _identity.block.cid.toString(base32),
          identity.block.cid.toString(base32)
        )
        assert.equal(_identity.pubkey.equals(identity.pubkey), true)
        assert.equal(_identity.name, undefined)
      })
    })

    describe('.import and .export', () => {
      it('imports an encoded identity/keypair', async () => {
        const name = names.name1
        const imported = await Identity.import({
          name,
          identities: tempIdentities,
          keychain: tempKeychain,
          kpi
        })

        assert.ok(await tempKeychain.exportKey(name, password))
        assert.deepEqual(
          imported.auth.toString(base32),
          identity.auth.toString(base32)
        )
        assert.ok(imported instanceof Identity)
      })

      it('rejects importing to an existing identity', async () => {
        const name = names.name1
        const promise = Identity.import({
          name,
          identities: tempIdentities,
          keychain: tempKeychain,
          kpi
        })

        await assert.rejects(promise)
      })

      it('exports an encoded identity/keypair', async () => {
        const name = names.name1
        const exported = await Identity.export({
          name,
          identities: tempIdentities,
          keychain: tempKeychain
        })

        assert.deepEqual(new Uint8Array(exported), new Uint8Array(exported))
      })

      it('rejects exporting a non-existant identity', async () => {
        const name = names.name2
        const promise = Identity.export({
          name,
          identities: tempIdentities,
          keychain: tempKeychain
        })

        await assert.rejects(promise)
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

      it('rejects verifying signatures without a pubkey', async () => {
        const _identity = await Identity.asIdentity({ block: identity.block }) as Identity
        _identity.pubkey = undefined as unknown as PublicKey

        const data = new Uint8Array([1])
        const sig = signedEmpty
        const promise = Identity.verify({ identity: _identity, data, sig })
        await assert.rejects(promise)
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

      it('rejects signing data without private key', async () => {
        const _identity = await Identity.asIdentity({ block: identity.block }) as Identity
        const data = dataEmpty
        const promise = _identity.sign(data)
        await assert.rejects(promise)
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
