
import { strict as assert } from 'assert'
import * as IPFS from 'ipfs'

import { Replica } from '../src/database/replica.js'

import { StaticAccess } from '../src/manifest/access/static.js'
import { Entry } from '../src/manifest/entry/index.js'
import { Identity } from '../src/manifest/identity/index.js'

import { cidstring } from '../src/util.js'

describe('Replica', () => {
  let ipfs, blocks, replica, manifest, access, identity
  const tag = new Uint8Array()

  before(async () => {
    ipfs = await IPFS.create()
    blocks = ipfs.block

    identity = await Identity.ephemeral()
    await blocks.put(identity.block.bytes, { version: 1, format: 'dag-cbor' })
    manifest = { tag, access: { write: [identity.id] } }
    access = await StaticAccess.open({ manifest })
  })

  after(async () => {
    await replica.close()
    await ipfs.stop()
  })

  describe('class', () => {
    it('exposes static properties', () => {
      assert.ok(Replica.open)
    })

    describe('open', () => {
      it('returns a new instance of a replica', async () => {
        replica = await Replica.open({ manifest, blocks, access, identity, Entry, Identity })
      })
    })
  })

  describe('instance', () => {
    const payload = {}
    const next = []
    const refs = []
    const cids = []

    it('exposes instance properties', () => {
      assert.ok(replica.manifest)
      assert.ok(replica.blocks)
      assert.ok(replica.access)
      assert.ok(replica.identity)
      assert.ok(replica.Entry)
      assert.ok(replica.Identity)
      assert.ok(replica.events)
      assert.ok(replica._graph)
      assert.ok(replica.close)
      assert.ok(replica.heads)
      assert.ok(replica.tails)
      assert.ok(replica.missing)
      assert.ok(replica.denied)
      assert.ok(replica.size === 0)
      assert.ok(replica.traverse)
      assert.ok(replica.has)
      assert.ok(replica.known)
      assert.ok(replica.add)
      assert.ok(replica.write)
    })

    describe('add', () => {
      it('adds an entry to the replica', async () => {
        const entry = await Entry.create({ identity, tag, payload, next, refs })
        const cid = entry.cid
        cids.push(cid)

        await replica.add([entry])

        assert.deepEqual(replica.heads, new Set([cidstring(cid)]))
        assert.deepEqual(replica.tails, new Set([cidstring(cid)]))
        assert.deepEqual(replica.missing, new Set())
        assert.deepEqual(replica.denied, new Set())
        assert.equal(replica.size, 1)
        assert.equal(await replica.has(cid), true)
        assert.equal(await replica.known(cid), true)
      })
    })

    describe('write', () => {
      it('writes an entry to the replica', async () => {
        const entry = await replica.write(payload)
        const cid = entry.cid
        cids.push(cid)

        assert.deepEqual(replica.heads, new Set([cidstring(cid)]))
        assert.deepEqual(replica.tails, new Set([cidstring(cids[0])]))
        assert.deepEqual(replica.missing, new Set())
        assert.deepEqual(replica.denied, new Set())
        assert.equal(replica.size, 2)
        assert.equal(await replica.has(cid), true)
        assert.equal(await replica.known(cid), true)
      })
    })

    describe('traverse', () => {
      it('descends the replica entry set', async () => {
        const entries = await replica.traverse()

        assert.deepEqual(entries.map(entry => entry.cid), cids.slice().reverse())
      })

      it('ascends the replica entry set', async () => {
        const direction = 'ascend'
        const entries = await replica.traverse({ direction })

        assert.deepEqual(entries.map(entry => entry.cid, cids), cids)
      })
    })
  })
})
