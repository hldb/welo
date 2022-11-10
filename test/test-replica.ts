import path from 'path'
import { strict as assert } from 'assert'
import { IPFS } from 'ipfs'
import { CID } from 'multiformats/cid'
import { start, stop } from '@libp2p/interfaces/startable'

import { Replica } from '../src/database/replica.js'

import { Blocks } from '../src/blocks/index.js'
import { Keyvalue } from '../src/store/keyvalue/index.js'
import { StaticAccess } from '../src/access/static/index.js'
import { Entry } from '../src/entry/default/index.js'
import { Identity } from '../src/identity/basal/index.js.js'
import { cidstring, decodedcid, defaultManifest } from '../src/utils/index.js'
import { Manifest } from '../src/manifest/default/index.js'
import { initRegistry } from '../src/registry/index.js'
import { LevelStorage, StorageReturn } from '../src/storage/index.js'

import {
  getIpfs,
  getIdentity,
  singleEntry,
  getStorageReturn
} from './utils/index.js'
import { tempPath } from './utils/constants.js'
import { Key } from 'interface-datastore'

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

  const Storage = async (name: string): Promise<StorageReturn> => await LevelStorage(path.join(tempPath, name))

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
    access = new StaticAccess({ manifest })
    await start(access)

    const temp = await getIdentity()
    await temp.storage.close()
    tempIdentity = temp.identity
  })

  after(async () => {
    await storage.close()
    await ipfs.stop()
  })

  describe('class', () => {
    describe('open', () => {
      it('returns a new instance of a replica', async () => {
        replica = new Replica({
          Storage,
          manifest,
          blocks,
          access,
          identity,
          Entry,
          Identity
        })
        await start(replica)
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
      assert.ok(replica.heads)
      assert.ok(replica.tails)
      assert.ok(replica.missing)
      assert.ok(replica.denied)
      assert.ok(replica.size)
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

        await replica.add([entry])

        assert.equal(await replica.size(), 1)
        assert.equal(await replica.has(cid), true)
        assert.equal(await replica.known(cid), true)
        assert.equal(await replica.heads.has(cidstring(cid)), true)
        assert.equal(await replica.heads.size(), 1)
        assert.equal(await replica.tails.has(cidstring(cid)), true)
        assert.equal(await replica.tails.size(), 1)
        assert.equal(await replica.missing.size(), 0)
        assert.equal(await replica.denied.size(), 0)

        await stop(replica)
      })

      it('does not add entry with mismatched tag', async () => {
        const tag = new Uint8Array([7])
        const entry = await Entry.create({
          identity,
          tag,
          payload,
          next: [],
          refs: []
        })
        const cid = entry.cid
        const replica = new Replica({
          Storage,
          manifest,
          blocks,
          access,
          identity,
          Entry,
          Identity
        })
        await start(replica)

        await replica.add([entry])

        assert.equal(await replica.size(), 0)
        assert.equal(await replica.has(cid), false)
        assert.equal(await replica.known(cid), false)
        assert.equal(await replica.heads.has(cidstring(cid)), false)
        assert.equal(await replica.heads.size(), 0)
        assert.equal(await replica.tails.has(cidstring(cid)), false)
        assert.equal(await replica.tails.size(), 0)
        assert.equal(await replica.missing.size(), 0)
        assert.equal(await replica.denied.size(), 0)

        await stop(replica)
      })

      it('does not add entry without access', async () => {
        const entry = await singleEntry(tempIdentity)()
        const cid = entry.cid
        const replica = new Replica({
          Storage,
          manifest,
          blocks,
          access,
          identity,
          Entry,
          Identity
        })
        await start(replica)

        await replica.add([entry])

        assert.equal(await replica.size(), 0)
        assert.equal(await replica.has(cid), false)
        assert.equal(await replica.known(cid), false)
        assert.equal(await replica.heads.has(cidstring(cid)), false)
        assert.equal(await replica.heads.size(), 0)
        assert.equal(await replica.tails.has(cidstring(cid)), false)
        assert.equal(await replica.tails.size(), 0)
        assert.equal(await replica.missing.size(), 0)
        assert.equal(await replica.denied.size(), 0)

        await stop(replica)
      })
    })

    describe('write', () => {
      it('writes an entry to the replica', async () => {
        await start(replica)
        const entry = await replica.write(payload)
        const cid = entry.cid
        cids.push(cid)

        assert.equal(await replica.size(), 1)
        assert.equal(await replica.has(cid), true)
        assert.equal(await replica.known(cid), true)
        assert.equal(await replica.heads.has(cidstring(cid)), true)
        assert.equal(await replica.heads.size(), 1)
        assert.equal(await replica.tails.has(cidstring(cid)), true)
        assert.equal(await replica.tails.size(), 1)
        assert.equal(await replica.missing.size(), 0)
        assert.equal(await replica.denied.size(), 0)
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
          entries.map((entry) => entry.cid),
          cids
        )
      })

      it('rejects when invalid direction is given', async () => {
        const direction = 'not a real direction'
        const promise = replica.traverse({ direction })

        await assert.rejects(promise)
      })
    })

    describe('data persistence', () => {
      it('writes the graph root to disk on update', async () => {
        const rootHashKey = new Key('rootHash')
        const block = await blocks.encode({ value: replica.graph.root })

        await stop(replica)

        const storage = await Storage('replica')
        await storage.open()

        assert.equal(await storage.has(rootHashKey), true)

        assert.deepEqual(decodedcid(await storage.get(rootHashKey)), block.cid)
        await storage.close()
      })

      it('loads the graph root from disk on start', async () => {
        const entry = await singleEntry(identity)()
        const cid = entry.cid
        const replica = new Replica({
          Storage,
          manifest,
          blocks,
          access,
          identity,
          Entry,
          Identity
        })
        await start(replica)

        assert.equal(await replica.size(), 1)
        assert.equal(await replica.has(cid), true)
        assert.equal(await replica.known(cid), true)
        assert.equal(await replica.heads.has(cidstring(cid)), true)
        assert.equal(await replica.heads.size(), 1)
        assert.equal(await replica.tails.has(cidstring(cid)), true)
        assert.equal(await replica.tails.size(), 1)
        assert.equal(await replica.missing.size(), 0)
        assert.equal(await replica.denied.size(), 0)

        await stop(replica)
      })
    })
  })
})
