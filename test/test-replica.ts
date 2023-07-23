/* eslint-disable max-nested-callbacks */
import { assert, expect } from 'aegir/chai'
import { start, stop } from '@libp2p/interfaces/startable'
import { Key } from 'interface-datastore'
import { ShardBlock, type ShardBlockView } from '@alanshaw/pail/shard'
import { NamespaceDatastore } from 'datastore-core'
import type { LevelDatastore } from 'datastore-level'
import type { CID } from 'multiformats/cid'

import { Replica } from '@/replica/index.js'
import { StaticAccess } from '@/access/static/index.js'
import { basalEntry } from '@/entry/basal/index.js'
import { Identity, basalIdentity } from '@/identity/basal/index.js'
import { cidstring, decodedcid } from '@/utils/index.js'
import { Manifest } from '@/manifest/index.js'

import { getLevelDatastore, getMemoryBlockstore } from './utils/storage.js'
import { getDefaultManifest } from './utils/manifest.js'
import { getTestPaths, names, tempPath, TestPaths } from './utils/constants.js'
import { getTestIdentities, getTestIdentity } from './utils/identities.js'
import { singleEntry } from './utils/entries.js'
import type { Blockstore } from 'interface-blockstore'
import { encodeCbor } from '@/utils/block.js'
import { createLibp2p } from 'libp2p'
import { getLibp2pDefaults } from './utils/libp2p/defaults.js'

const testName = 'replica'

describe(testName, () => {
  let
    blockstore: Blockstore,
    replica: Replica,
    manifest: Manifest,
    access: StaticAccess,
    identity: Identity,
    tempIdentity: Identity,
    testPaths: TestPaths,
    emptyShard: ShardBlockView,
    datastore: LevelDatastore

  const entryModule = basalEntry()
  const identityModule = basalIdentity()

  before(async () => {
    testPaths = getTestPaths(tempPath, testName)

    datastore = await getLevelDatastore(testPaths.replica)
    await datastore.open()
    blockstore = getMemoryBlockstore()

    const identities = await getTestIdentities(testPaths)

    const libp2p = await createLibp2p(await getLibp2pDefaults())
    const keychain = libp2p.keychain

    identity = await getTestIdentity(identities, keychain, names.name0)

    await blockstore.put(identity.block.cid, identity.block.bytes)

    manifest = await Manifest.create({
      ...getDefaultManifest('name', identity),
      tag: new Uint8Array()
    })
    access = new StaticAccess({ manifest })
    await start(access)

    const testPaths1 = getTestPaths(tempPath, testName + '1')
    const tempIdentities = await getTestIdentities(testPaths1)
    const tempLibp2p = await createLibp2p(await getLibp2pDefaults())
    tempIdentity = await getTestIdentity(
      tempIdentities,
      tempLibp2p.keychain,
      names.name1
    )

    emptyShard = await ShardBlock.create()
  })

  after(async () => {
    await datastore.close()
  })

  describe('class', () => {
    describe('open', () => {
      it('returns a new instance of a replica', async () => {
        replica = new Replica({
          datastore: new NamespaceDatastore(datastore, new Key(`${testPaths.replica}/temp`)),
          blockstore,
          manifest,
          access,
          identity,
          components: {
            entry: entryModule,
            identity: identityModule
          }
        })
        await start(replica)
      })
    })
  })

  describe('instance', () => {
    const cids: CID[] = []
    const payload = {}

    it('exposes instance properties', () => {
      assert.isOk(replica.manifest)
      assert.isOk(replica.access)
      assert.isOk(replica.identity)
      assert.isOk(replica.components.entry)
      assert.isOk(replica.components.identity)
      assert.isOk(replica.events)
      assert.isOk(replica.heads)
      assert.isOk(replica.tails)
      assert.isOk(replica.missing)
      assert.isOk(replica.denied)
      assert.isOk(replica.traverse)
      assert.isOk(replica.has)
      assert.isOk(replica.known)
      assert.isOk(replica.add)
      assert.isOk(replica.write)
    })

    describe('add', () => {
      beforeEach(async () => {
        await start(replica)
      })
      afterEach(async () => {
        await stop(replica)
      })

      it('does not add entry with mismatched tag', async () => {
        const tag = new Uint8Array([7])
        const entry = await entryModule.create({
          identity,
          tag,
          payload,
          next: [],
          refs: []
        })
        const cid = entry.cid

        await replica.add([entry])

        // assert.strictEqual(await replica.size(), 0)
        assert.strictEqual(await replica.has(cid), false)
        assert.strictEqual(await replica.known(cid), false)
        assert.strictEqual(await replica.heads.has(new Key(cidstring(cid))), false)
        assert.strictEqual(replica.graph.root.heads.equals(emptyShard.cid), true)
        // assert.strictEqual(await replica.heads.size(), 0)
        assert.strictEqual(await replica.tails.has(new Key(cidstring(cid))), false)
        assert.strictEqual(replica.graph.root.tails.equals(emptyShard.cid), true)
        assert.strictEqual(replica.graph.root.missing.equals(emptyShard.cid), true)
        assert.strictEqual(replica.graph.root.denied.equals(emptyShard.cid), true)
        // assert.strictEqual(await replica.tails.size(), 0)
        // assert.strictEqual(await replica.missing.size(), 0)
        // assert.strictEqual(await replica.denied.size(), 0)
      })

      it('does not add entry without access', async () => {
        const entry = await singleEntry(tempIdentity)()
        const cid = entry.cid

        await replica.add([entry])

        // assert.strictEqual(await replica.size(), 0)
        assert.strictEqual(await replica.has(cid), false)
        assert.strictEqual(await replica.known(cid), false)
        assert.strictEqual(await replica.heads.has(new Key(cidstring(cid))), false)
        assert.strictEqual(replica.graph.root.heads.equals(emptyShard.cid), true)
        // assert.strictEqual(await replica.heads.size(), 0)
        assert.strictEqual(await replica.tails.has(new Key(cidstring(cid))), false)
        assert.strictEqual(replica.graph.root.tails.equals(emptyShard.cid), true)
        assert.strictEqual(replica.graph.root.missing.equals(emptyShard.cid), true)
        assert.strictEqual(replica.graph.root.denied.equals(emptyShard.cid), true)
        // assert.strictEqual(await replica.tails.size(), 0)
        // assert.strictEqual(await replica.missing.size(), 0)
        // assert.strictEqual(await replica.denied.size(), 0)
      })

      it('adds an entry to the replica', async () => {
        const entry = await singleEntry(identity)()
        const cid = entry.cid

        await replica.add([entry])

        // assert.strictEqual(await replica.size(), 1)
        assert.strictEqual(await replica.has(cid), true)
        assert.strictEqual(await replica.known(cid), true)
        assert.strictEqual(await replica.heads.has(new Key(cidstring(cid))), true)
        // assert.strictEqual(await replica.heads.size(), 1)
        assert.strictEqual(await replica.tails.has(new Key(cidstring(cid))), true)
        assert.strictEqual(replica.graph.root.missing.equals(emptyShard.cid), true)
        assert.strictEqual(replica.graph.root.denied.equals(emptyShard.cid), true)
        // assert.strictEqual(await replica.tails.size(), 1)
        // assert.strictEqual(await replica.missing.size(), 0)
        // assert.strictEqual(await replica.denied.size(), 0)
      })
    })

    describe('write', () => {
      before(async () => {
        replica = new Replica({
          datastore: new NamespaceDatastore(datastore, new Key(testPaths.replica)),
          blockstore,
          manifest,
          access,
          identity,
          components: {
            entry: entryModule,
            identity: identityModule
          }
        })
        await start(replica)
      })

      it('writes an entry to the replica', async () => {
        const entry = await replica.write(payload)
        const cid = entry.cid
        cids.push(cid)

        // assert.strictEqual(await replica.size(), 1)
        assert.strictEqual(await replica.has(cid), true)
        assert.strictEqual(await replica.known(cid), true)
        assert.strictEqual(await replica.heads.has(new Key(cidstring(cid))), true)
        // assert.strictEqual(await replica.heads.size(), 1)
        assert.strictEqual(await replica.tails.has(new Key(cidstring(cid))), true)
        // assert.strictEqual(await replica.tails.size(), 1)
        assert.strictEqual(replica.graph.root.missing.equals(emptyShard.cid), true)
        assert.strictEqual(replica.graph.root.denied.equals(emptyShard.cid), true)
        // assert.strictEqual(await replica.missing.size(), 0)
        // assert.strictEqual(await replica.denied.size(), 0)
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
        // @ts-expect-error
        const promise = replica.traverse({ direction })

        await expect(promise).to.eventually.be.rejected()
      })
    })

    describe('data persistence', () => {
      it('writes the graph root to disk on update', async () => {
        const rootHashKey = new Key('rootHash')
        const block = await encodeCbor(replica.graph.root)

        await datastore.close()
        await stop(replica)

        const newDatastore = await getLevelDatastore(testPaths.replica)
        await newDatastore.open()
        const storage = new NamespaceDatastore(newDatastore, new Key(testPaths.replica))

        assert.strictEqual(await storage.has(rootHashKey), true)

        assert.deepEqual(decodedcid(await storage.get(rootHashKey)), block.cid)
        await newDatastore.close()
      })

      it('loads the graph root from disk on start', async () => {
        const entry = await singleEntry(identity)()
        const cid = entry.cid

        const newDatastore = await getLevelDatastore(testPaths.replica)
        await newDatastore.open()

        const replica = new Replica({
          datastore: new NamespaceDatastore(newDatastore, new Key(testPaths.replica)),
          blockstore,
          manifest,
          access,
          identity,
          components: {
            entry: entryModule,
            identity: identityModule
          }
        })
        await start(replica)

        // assert.strictEqual(await replica.size(), 1)
        assert.strictEqual(await replica.has(cid), true)
        assert.strictEqual(await replica.known(cid), true)
        assert.strictEqual(await replica.heads.has(new Key(cidstring(cid))), true)
        // assert.strictEqual(await replica.heads.size(), 1)
        assert.strictEqual(await replica.tails.has(new Key(cidstring(cid))), true)
        // assert.strictEqual(await replica.tails.size(), 1)
        assert.strictEqual(replica.graph.root.missing.equals(emptyShard.cid), true)
        assert.strictEqual(replica.graph.root.denied.equals(emptyShard.cid), true)
        // assert.strictEqual(await replica.missing.size(), 0)
        // assert.strictEqual(await replica.denied.size(), 0)
        assert.strictEqual(replica.graph.root.missing.equals(emptyShard.cid), true)
        assert.strictEqual(replica.graph.root.denied.equals(emptyShard.cid), true)

        await stop(replica)
      })
    })
  })
})
