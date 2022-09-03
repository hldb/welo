
import { strict as assert } from 'assert'
import { base32 } from 'multiformats/bases/base32'

import { Blocks } from '../src/blocks.js'
import { Identity } from '../src/manifest/identity/index.js'

import { getIpfs, getIdentity, constants } from './utils/index.js'
const { fixt, names } = constants

const dataEmpty = new Uint8Array()
const signedEmpty = base32.decode('bgbcqeiiayc2skoa4am3u3kmq4io6zjspbroxyfw2duj2lzxagrxfoafes4eaeid3eayxiin7neu6s4jhngwj2uoxoxxhzrdcckhtinpqtugc64tyze')
const kpi = base32.decode('bujrxazlnpbwg2tklmzzgentqjj2vk3zziuyhqz3sgvde6zblpjtxezzsjfzha5rqpfrxq2tzlfqs63btjrxuiwdcjjlve6ktnf3veqzujeztknbtpjcxo5rynnuviulsjvwfcmlqnizgg3cyhbbdc4rxhblfsudnjvshel2wpjdwqtdxizufkqknnbuwizlooruxi6kyukrwe2lelasqqaqseebd2dcxup53qcflrr74f6ov4sulbeqtr7gebgvly7yjp4cpqcb62o3dob2wewbfbabbeiichugfpi73xaekxdd7yl45lzfiwcjbhd6micnkxr7qs7ye7aed5u5wg43jm5memmceaiqbxmbfxub7wpfe7o4kedmlpyvgxacrbk4sizxhqa57g6r6r4xk4kicebxx2krffxna23pegemozn6abevp4yezrcejs7a6ag4nw6auub3m6')
const authstring = 'bafyreibvk33g3t2jktm3i7q7vwugu3mqoc3oajlymb7u46qn6kqpsexl4u'

describe('Base Identity', () => {
  let ipfs, blocks, storage, identities, keychain, identity
  let tempStorage, tempIdentities, tempKeychain
  const expectedType = 'base'
  const name = names.name0
  const password = ''

  before(async () => {
    ipfs = await getIpfs(fixt.ipfs)
    blocks = new Blocks(ipfs)

    const got = await getIdentity(fixt.path, name)
    identity = got.identity
    storage = got.storage
    identities = storage.identities
    keychain = got.keychain

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
      it('imports an encoded identity/keypair', async () => {
        const name = names.name1
        const imported = await Identity.import({
          name,
          identities: tempIdentities,
          keychain: tempKeychain,
          kpi,
          password
        })

        assert.ok(await tempKeychain.exportKey(name, password))
        assert.deepEqual(imported.auth.toString(base32), identity.auth.toString(base32))
        assert.ok(imported instanceof Identity)
      })

      it('exports an encoded identity/keypair', async () => {
        const name = names.name1
        const exported = await Identity.export({
          name,
          identities: tempIdentities,
          keychain: tempKeychain,
          password
        })

        assert.deepEqual(new Uint8Array(exported), new Uint8Array(exported))
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
