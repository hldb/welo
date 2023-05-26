import { assert } from './utils/chai.js'
import type { Helia } from '@helia/interface'
import type { PublicKey } from '@libp2p/interface-keys'
import { base32 } from 'multiformats/bases/base32'
import type { Datastore } from 'interface-datastore'

import { Identity } from '@/identity/basal/index.js'
import { Blocks } from '@/blocks/index.js'
import type { KeyChain } from '@/utils/types.js'

import { fixtPath, getTestPaths, names, tempPath } from './utils/constants.js'
import { getTestIpfs, offlineIpfsOptions } from './utils/ipfs.js'
import { getTestIdentities, kpi } from './utils/identities.js'
import { getTestLibp2p } from './utils/libp2p.js'

const testName = 'basal identity'

describe(testName, () => {
  let ipfs: Helia,
    blocks: Blocks,
    identities: Datastore,
    keychain: KeyChain,
    identity: Identity
  let tempIpfs: Helia, tempIdentities: Datastore, tempKeychain: KeyChain
  const expectedProtocol = '/hldb/identity/basal'
  const name = names.name0
  const password = ''

  const dataEmpty = new Uint8Array()
  const signedEmpty = base32.decode(
    'bgbcqeiiayc2skoa4am3u3kmq4io6zjspbroxyfw2duj2lzxagrxfoafes4eaeid3eayxiin7neu6s4jhngwj2uoxoxxhzrdcckhtinpqtugc64tyze'
  )
  const authstring =
    'bafyreibvk33g3t2jktm3i7q7vwugu3mqoc3oajlymb7u46qn6kqpsexl4u'

  before(async () => {
    const fixtTestPaths = getTestPaths(fixtPath, testName)
    ipfs = await getTestIpfs(fixtTestPaths, offlineIpfsOptions)
    blocks = new Blocks(ipfs)

    identities = await getTestIdentities(fixtTestPaths)
    const libp2p = await getTestLibp2p(ipfs)
    keychain = libp2p.keychain

    identity = await Identity.import({
      name,
      identities,
      keychain,
      kpi
    }).catch(async () => await Identity.get({ name, identities, keychain }))

    const tempTestPaths = getTestPaths(tempPath, testName)
    tempIpfs = await getTestIpfs(tempTestPaths, offlineIpfsOptions)

    tempIdentities = await getTestIdentities(tempTestPaths)
    const tempLibp2p = await getTestLibp2p(ipfs)
    tempKeychain = tempLibp2p.keychain
  })

  after(async () => {
    await ipfs.stop()
    await tempIpfs.stop()
  })

  describe('Class', () => {
    it('exposes static properties', () => {
      assert.isOk(Identity.protocol)
      assert.isOk(Identity.get)
      assert.isOk(Identity.fetch)
      assert.isOk(Identity.asIdentity)
      assert.isOk(Identity.export)
      assert.isOk(Identity.import)
      assert.isOk(Identity.verify)
    })

    it(`.type is equal to '${expectedProtocol}'`, () => {
      assert.strictEqual(Identity.protocol, expectedProtocol)
    })

    describe('.get', () => {
      it('grabs existing identity', async () => {
        identity = await Identity.get({ name, identities, keychain })
        assert.strictEqual(identity.name, name)
        assert.strictEqual(identity.block.cid.toString(base32), authstring)
        assert.isOk(identity instanceof Identity)
      })

      it('creates a new identity', async () => {
        const randomName = Math.random().toString()
        const _identity = await Identity.get({
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
        await blocks.put(identity.block)
        const _identity = await Identity.fetch({ blocks, auth: identity.auth })
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
        const _identity = (Identity.asIdentity(identity)) as Identity
        assert.strictEqual(_identity, identity)
        assert.strictEqual(
          _identity.block.cid.toString(base32),
          identity.block.cid.toString(base32)
        )
        assert.strictEqual(_identity.pubkey.equals(identity.pubkey), true)
        assert.strictEqual(_identity.name, name)
      })

      it('returns a new instance if needed', async () => {
        const _identity = (Identity.asIdentity({
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
        const imported = await Identity.import({
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
        const promise = Identity.import({
          name,
          identities: tempIdentities,
          keychain: tempKeychain,
          kpi
        })

        await assert.isRejected(promise)
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

        await assert.isRejected(promise)
      })
    })

    describe('.sign', () => {
      it('signs an empty byte array', async () => {
        const data = dataEmpty
        const sig = await Identity.sign(identity, data)
        assert.isOk(sig instanceof Uint8Array)
        assert.strictEqual(sig.toString(), signedEmpty.toString())
      })
    })

    describe('.verify', () => {
      it('verifies a valid signature', async () => {
        const data = dataEmpty
        const sig = signedEmpty
        const verified = await Identity.verify(identity, data, sig)
        assert.strictEqual(verified, true)
      })

      it('unverifies an invalid signature', async () => {
        const data = new Uint8Array([1])
        const sig = signedEmpty
        const verified = await Identity.verify(identity, data, sig)
        assert.strictEqual(verified, false)
      })

      it('rejects verifying signatures without a pubkey', async () => {
        const _identity = (Identity.asIdentity({
          block: identity.block
        })) as Identity
        _identity.pubkey = undefined as unknown as PublicKey

        const data = new Uint8Array([1])
        const sig = signedEmpty
        const promise = Identity.verify(_identity, data, sig)
        await assert.isRejected(promise)
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
        const _identity = (Identity.asIdentity({
          block: identity.block
        })) as Identity
        const data = dataEmpty
        const promise = _identity.sign(data)
        await assert.isRejected(promise)
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
