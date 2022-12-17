import { strict as assert } from 'assert'
import type { IPFS } from 'ipfs-core-types'
import type { PublicKey } from '@libp2p/interface-keys'
import { base32 } from 'multiformats/bases/base32'
import type { Datastore } from 'interface-datastore'

import { Identity } from '~identity/basal/index.js'
import { Blocks } from '~blocks/index.js'
import type { KeyChain } from '~utils/types.js'

import { fixtPath, getTestPaths, names, tempPath } from './utils/constants.js'
import { getTestIpfs, offlineIpfsOptions } from './utils/ipfs.js'
import { getTestIdentities, kpi } from './utils/identities.js'
import { getTestLibp2p } from './utils/libp2p.js'

const testName = 'basal identity'

describe(testName, () => {
  let ipfs: IPFS,
    blocks: Blocks,
    identities: Datastore,
    keychain: KeyChain,
    identity: Identity
  let tempIpfs: IPFS, tempIdentities: Datastore, tempKeychain: KeyChain
  const expectedProtocol = '/opalsnt/identity/basal'
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
      assert.ok(Identity.protocol)
      assert.ok(Identity.get)
      assert.ok(Identity.fetch)
      assert.ok(Identity.asIdentity)
      assert.ok(Identity.export)
      assert.ok(Identity.import)
      assert.ok(Identity.verify)
    })

    it(`.type is equal to '${expectedProtocol}'`, () => {
      assert.equal(Identity.protocol, expectedProtocol)
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
        const sig = await Identity.sign(identity, data)
        assert.ok(sig instanceof Uint8Array)
        assert.equal(sig.toString(), signedEmpty.toString())
      })
    })

    describe('.verify', () => {
      it('verifies a valid signature', async () => {
        const data = dataEmpty
        const sig = signedEmpty
        const verified = await Identity.verify(identity, data, sig)
        assert.equal(verified, true)
      })

      it('unverifies an invalid signature', async () => {
        const data = new Uint8Array([1])
        const sig = signedEmpty
        const verified = await Identity.verify(identity, data, sig)
        assert.equal(verified, false)
      })

      it('rejects verifying signatures without a pubkey', async () => {
        const _identity = (await Identity.asIdentity({
          block: identity.block
        })) as Identity
        _identity.pubkey = undefined as unknown as PublicKey

        const data = new Uint8Array([1])
        const sig = signedEmpty
        const promise = Identity.verify(_identity, data, sig)
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
        const _identity = (await Identity.asIdentity({
          block: identity.block
        })) as Identity
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
