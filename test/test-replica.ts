import { assert } from './utils/chai.js'
import { start, stop } from '@libp2p/interfaces/startable'
import { Key } from 'interface-datastore'
import { LevelDatastore } from 'datastore-level'
import type { Helia } from '@helia/interface'
import type { CID } from 'multiformats/cid'

import { Replica } from '~replica/index.js'
import { Blocks } from '~blocks/index.js'
import { Keyvalue } from '~store/keyvalue/index.js'
import { StaticAccess } from '~access/static/index.js'
import { Entry } from '~entry/basal/index.js'
import { Identity } from '~identity/basal/index.js'
import { cidstring, decodedcid, defaultManifest } from '~utils/index.js'
import { Manifest } from '~manifest/index.js'
import { initRegistry } from '../src/registry.js'

import { getTestPaths, names, tempPath, TestPaths } from './utils/constants.js'
import { getTestIpfs, offlineIpfsOptions } from './utils/ipfs.js'
import { getTestIdentities, getTestIdentity } from './utils/identities.js'
import { singleEntry } from './utils/entries.js'
import { getTestLibp2p } from './utils/libp2p.js'
import { getDatastore } from '~utils/datastore.js'

const testName = 'replica'

describe(testName, () => {
  let ipfs: Helia,
    tempIpfs: Helia,
    blocks: Blocks,
    replica: Replica,
    manifest: Manifest,
    access: StaticAccess,
    identity: Identity,
    tempIdentity: Identity,
    testPaths: TestPaths

  const Datastore = LevelDatastore

  const registry = initRegistry()

  registry.store.add(Keyvalue)
  registry.access.add(StaticAccess)
  registry.entry.add(Entry)
  registry.identity.add(Identity)

  before(async () => {
    testPaths = getTestPaths(tempPath, testName)
    ipfs = await getTestIpfs(testPaths, offlineIpfsOptions)
    blocks = new Blocks(ipfs)

    const identities = await getTestIdentities(testPaths)
    const libp2p = await getTestLibp2p(ipfs)
    const keychain = libp2p.keychain

    identity = await getTestIdentity(identities, keychain, names.name0)

    await blocks.put(identity.block)

    manifest = await Manifest.create({
      ...defaultManifest('name', identity, registry),
      tag: new Uint8Array()
    })
    access = new StaticAccess({ manifest })
    await start(access)

    const testPaths1 = getTestPaths(tempPath, testName + '1')
    tempIpfs = await getTestIpfs(testPaths1, offlineIpfsOptions)
    const tempLibp2p = await getTestLibp2p(tempIpfs)
    const tempIdentities = await getTestIdentities(testPaths1)
    tempIdentity = await getTestIdentity(
      tempIdentities,
      tempLibp2p.keychain,
      names.name1
    )
  })

  after(async () => {
    await stop(ipfs)
    await stop(tempIpfs)
  })

  describe('class', () => {
    describe('open', () => {
      it('returns a new instance of a replica', async () => {
        replica = new Replica({
          Datastore,
          manifest,
          directory: testPaths.replica,
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
      assert.isOk(replica.manifest)
      assert.isOk(replica.blocks)
      assert.isOk(replica.access)
      assert.isOk(replica.identity)
      assert.isOk(replica.Entry)
      assert.isOk(replica.Identity)
      assert.isOk(replica.events)
      assert.isOk(replica.heads)
      assert.isOk(replica.tails)
      assert.isOk(replica.missing)
      assert.isOk(replica.denied)
      assert.isOk(replica.size)
      assert.isOk(replica.traverse)
      assert.isOk(replica.has)
      assert.isOk(replica.known)
      assert.isOk(replica.add)
      assert.isOk(replica.write)
    })

    describe('add', () => {
      it('adds an entry to the replica', async () => {
        const entry = await singleEntry(identity)()
        const cid = entry.cid

        await replica.add([entry])

        assert.strictEqual(await replica.size(), 1)
        assert.strictEqual(await replica.has(cid), true)
        assert.strictEqual(await replica.known(cid), true)
        assert.strictEqual(await replica.heads.has(cidstring(cid)), true)
        assert.strictEqual(await replica.heads.size(), 1)
        assert.strictEqual(await replica.tails.has(cidstring(cid)), true)
        assert.strictEqual(await replica.tails.size(), 1)
        assert.strictEqual(await replica.missing.size(), 0)
        assert.strictEqual(await replica.denied.size(), 0)

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
          Datastore,
          manifest,
          directory: testPaths.replica,
          blocks,
          access,
          identity,
          Entry,
          Identity
        })
        await start(replica)

        await replica.add([entry])

        assert.strictEqual(await replica.size(), 0)
        assert.strictEqual(await replica.has(cid), false)
        assert.strictEqual(await replica.known(cid), false)
        assert.strictEqual(await replica.heads.has(cidstring(cid)), false)
        assert.strictEqual(await replica.heads.size(), 0)
        assert.strictEqual(await replica.tails.has(cidstring(cid)), false)
        assert.strictEqual(await replica.tails.size(), 0)
        assert.strictEqual(await replica.missing.size(), 0)
        assert.strictEqual(await replica.denied.size(), 0)

        await stop(replica)
      })

      it('does not add entry without access', async () => {
        const entry = await singleEntry(tempIdentity)()
        const cid = entry.cid
        const replica = new Replica({
          Datastore,
          manifest,
          directory: testPaths.replica,
          blocks,
          access,
          identity,
          Entry,
          Identity
        })
        await start(replica)

        await replica.add([entry])

        assert.strictEqual(await replica.size(), 0)
        assert.strictEqual(await replica.has(cid), false)
        assert.strictEqual(await replica.known(cid), false)
        assert.strictEqual(await replica.heads.has(cidstring(cid)), false)
        assert.strictEqual(await replica.heads.size(), 0)
        assert.strictEqual(await replica.tails.has(cidstring(cid)), false)
        assert.strictEqual(await replica.tails.size(), 0)
        assert.strictEqual(await replica.missing.size(), 0)
        assert.strictEqual(await replica.denied.size(), 0)

        await stop(replica)
      })
    })

    describe('write', () => {
      it('writes an entry to the replica', async () => {
        await start(replica)
        const entry = await replica.write(payload)
        const cid = entry.cid
        cids.push(cid)

        assert.strictEqual(await replica.size(), 1)
        assert.strictEqual(await replica.has(cid), true)
        assert.strictEqual(await replica.known(cid), true)
        assert.strictEqual(await replica.heads.has(cidstring(cid)), true)
        assert.strictEqual(await replica.heads.size(), 1)
        assert.strictEqual(await replica.tails.has(cidstring(cid)), true)
        assert.strictEqual(await replica.tails.size(), 1)
        assert.strictEqual(await replica.missing.size(), 0)
        assert.strictEqual(await replica.denied.size(), 0)
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

        await assert.isRejected(promise)
      })
    })

    describe('data persistence', () => {
      it('writes the graph root to disk on update', async () => {
        const rootHashKey = new Key('rootHash')
        const block = await blocks.encode({ value: replica.graph.root })

        await stop(replica)

        const storage = await getDatastore(Datastore, testPaths.replica)
        await storage.open()

        assert.strictEqual(await storage.has(rootHashKey), true)

        assert.deepEqual(decodedcid(await storage.get(rootHashKey)), block.cid)
        await storage.close()
      })

      it('loads the graph root from disk on start', async () => {
        const entry = await singleEntry(identity)()
        const cid = entry.cid
        const replica = new Replica({
          Datastore,
          manifest,
          directory: testPaths.replica,
          blocks,
          access,
          identity,
          Entry,
          Identity
        })
        await start(replica)

        assert.strictEqual(await replica.size(), 1)
        assert.strictEqual(await replica.has(cid), true)
        assert.strictEqual(await replica.known(cid), true)
        assert.strictEqual(await replica.heads.has(cidstring(cid)), true)
        assert.strictEqual(await replica.heads.size(), 1)
        assert.strictEqual(await replica.tails.has(cidstring(cid)), true)
        assert.strictEqual(await replica.tails.size(), 1)
        assert.strictEqual(await replica.missing.size(), 0)
        assert.strictEqual(await replica.denied.size(), 0)

        await stop(replica)
      })
    })
  })
})
