
import { strict as assert } from 'assert'
import { base32 } from 'multiformats/bases/base32'
import * as Block from 'multiformats/block'
import * as codec from '@ipld/dag-cbor'
import { sha256 as hasher } from 'multiformats/hashes/sha2'

import { Entry } from '../src/manifest/entry/index.js'
import { Identity } from '../src/manifest/identity/index.js'

import { getIpfs, getIdentity, constants } from './utils/index.js'
const { fixt, names } = constants

describe('Base Entry', () => {
  let ipfs, blocks, storage, identity, entry
  const expectedType = 'base'
  const name = names.name0

  const tag = new Uint8Array()
  const payload = {}
  const next = []
  const refs = []

  before(async () => {
    ipfs = await getIpfs(fixt.ipfs)
    blocks = ipfs.block // replace this with a local block store later

    const got = await getIdentity(fixt.path, name)

    identity = got.identity
    storage = got.storage
  })

  after(async () => {
    await storage.close()
    await ipfs.stop()
  })

  describe('Class', () => {
    it('exposes static properties', () => {
      assert.ok(Entry.type)
      assert.ok(Entry.create)
      assert.ok(Entry.fetch)
      assert.ok(Entry.asEntry)
      assert.ok(Entry.verify)
    })

    it(`.type is equal to '${expectedType}'`, () => {
      assert.equal(Entry.type, expectedType)
    })

    it('.create returns a new entry', async () => {
      entry = await Entry.create({ identity, tag, payload, next, refs })
      assert.equal(entry.identity, identity)
      assert.deepEqual(entry.tag, tag)
      assert.deepEqual(entry.payload, payload)
      assert.deepEqual(entry.next, next)
      assert.deepEqual(entry.refs, refs)
      assert.equal(entry.cid.toString(base32), 'bafyreigadrjqfm7spuib6vfftxzhenb2psuxkyc56xtx4qr7z7k5fk6wrm')
    })

    it('.fetch grabs an existing entry', async () => {
      const _entry = await Entry.fetch({ blocks, Identity, cid: entry.cid })
      assert.notEqual(_entry, entry)
      assert.deepEqual(_entry.block, entry.block)
      assert.deepEqual(_entry.identity.auth, entry.identity.auth)
    })

    describe('.asEntry', () => {
      it('returns the same instance if possible', async () => {
        const _entry = await Entry.asEntry(entry)
        assert.equal(_entry, entry)
      })

      it('returns a new instance if necessary', async () => {
        const _entry = await Entry.asEntry({ block: entry.block, identity: entry.identity })
        assert.notEqual(_entry, entry)
        assert.deepEqual(_entry, entry)
      })
    })

    describe('.verify', () => {
      it('verifies entry with valid signature', async () => {
        const verified = await Entry.verify(entry)
        assert.equal(verified, true)
      })

      it('unverifies entry with invalid signature', async () => {
        const value = { ...entry.block.value, sig: new Uint8Array() }
        const block = await Block.encode({ value, codec, hasher })
        const _entry = await Entry.asEntry({ block, identity })
        const verified = await Entry.verify(_entry)
        assert.equal(verified, false)
      })

      it('unverifies entry with mismatched identity', async () => {
        const { identity, storage } = await getIdentity()
        await storage.close()

        const _entry = await Entry.asEntry({ block: entry.block, identity })
        const verified = await Entry.verify(_entry)
        assert.equal(verified, false)
      })
    })
  })

  describe('Instance', () => {
    it('exposes instance properties', async () => {
      assert.ok(entry.block)
      assert.ok(entry.cid)
      assert.ok(entry.identity)
      assert.ok(entry.auth)
      assert.ok(entry.sig)
      assert.ok(entry.v)
      assert.ok(entry.tag)
      assert.ok(entry.payload)
      assert.ok(entry.next)
      assert.ok(entry.refs)
      assert.equal(entry.cid, entry.block.cid)
      assert.equal(entry.auth, entry.block.value.auth)
      assert.equal(entry.sig, entry.block.value.sig)
      const data = await Block.decode({ bytes: entry.block.value.data, codec, hasher })
      assert.equal(entry.v, data.value.v)
      assert.deepEqual(entry.tag, data.value.tag)
      assert.deepEqual(entry.payload, data.value.payload)
      assert.deepEqual(entry.next, data.value.next)
      assert.deepEqual(entry.refs, data.value.refs)
    })
  })
})
