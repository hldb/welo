import { strict as assert } from 'assert'

import { Replica } from '../src/database/replica.js'

import { Blocks } from '../src/mods/blocks.js'
import { Keyvalue } from '../src/manifest/store/keyvalue.js'
import { StaticAccess } from '../src/manifest/access/static.js'
import { Entry } from '../src/manifest/entry/index.js'
import { Identity } from '../src/manifest/identity/index.js'
import { cidstring, defaultManifest } from '../src/util.js'
import { Manifest } from '../src/manifest/index.js'
import { initRegistry } from '../src/registry.js'

import {
  getIpfs,
  getIdentity,
  singleEntry,
  getStorageReturn
} from './utils/index.js'
import { IPFS } from 'ipfs'
import { CID } from 'multiformats/cid.js'

const registry = initRegistry()

registry.store.add(Keyvalue)
registry.access.add(StaticAccess)
registry.entry.add(Entry)
registry.identity.add(Identity)

describe('Replica', () => {
  let ipfs: IPFS,
    blocks: Blocks,
    storage: getStorageReturn,
    replica: Replica,
    manifest: Manifest,
    access: StaticAccess,
    identity: Identity,
    tempIdentity: Identity

  before(async () => {
    ipfs = await getIpfs()
    blocks = new Blocks(ipfs)

    const got = await getIdentity()
    storage = got.storage
    identity = got.identity

    await blocks.put(identity.block)

    manifest = await Manifest.create({
      ...defaultManifest('name', identity, registry),
      tag: new Uint8Array()
    })
    access = await StaticAccess.open({ manifest })

    const temp = await getIdentity()
    await temp.storage.close()
    tempIdentity = temp.identity
  })

  after(async () => {
    await replica.close()
    await storage.close()
    await ipfs.stop()
  })

  describe('class', () => {
    it('exposes static properties', () => {
      assert.ok(Replica.open)
    })

    describe('open', () => {
      it('returns a new instance of a replica', async () => {
        replica = await Replica.open({
          manifest,
          blocks,
          access,
          identity,
          Entry,
          Identity
        })
      })
    })
  })

  describe('instance', () => {
    const cids: CID[] = []
    const payload = {}

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
        const entry = await singleEntry(identity)()
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

      it('does not add entry with mismatched tag', async () => {
        const tag = new Uint8Array([7])
        const entry = await Entry.create({ identity, tag, payload, next: [], refs: [] })
        const cid = entry.cid
        const replica = await Replica.open({
          manifest,
          blocks,
          access,
          identity,
          Entry,
          Identity
        })

        await replica.add([entry])

        assert.deepEqual(replica.heads, new Set())
        assert.deepEqual(replica.tails, new Set())
        assert.deepEqual(replica.missing, new Set())
        assert.deepEqual(replica.denied, new Set())
        assert.equal(replica.size, 0)
        assert.equal(await replica.has(cid), false)
        assert.equal(await replica.known(cid), false)
        await replica.close()
      })

      it('does not add entry without access', async () => {
        const entry = await singleEntry(tempIdentity)()
        const cid = entry.cid
        const replica = await Replica.open({
          manifest,
          blocks,
          access,
          identity,
          Entry,
          Identity
        })

        await replica.add([entry])

        assert.deepEqual(replica.heads, new Set())
        assert.deepEqual(replica.tails, new Set())
        assert.deepEqual(replica.missing, new Set())
        assert.deepEqual(replica.denied, new Set())
        assert.equal(replica.size, 0)
        assert.equal(await replica.has(cid), false)
        assert.equal(await replica.known(cid), false)
        await replica.close()
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

        assert.deepEqual(
          entries.map((entry) => entry.cid),
          cids.slice().reverse()
        )
      })

      it('ascends the replica entry set', async () => {
        const direction = 'ascend'
        const entries = await replica.traverse({ direction })

        assert.deepEqual(
          entries.map((entry) => entry.cid, cids),
          cids
        )
      })

      it('rejects when invalid direction is given', async () => {
        const direction = 'not a real direction'
        const promise = replica.traverse({ direction })

        await assert.rejects(promise)
      })
    })
  })
})
