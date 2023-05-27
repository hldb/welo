import { assert } from './utils/chai.js'
import type { Helia } from '@helia/interface'
import type { CID } from 'multiformats/cid'
import { base32 } from 'multiformats/bases/base32'
import type { LevelDatastore } from 'datastore-level'
import type { KeyChain } from '@libp2p/interface-keychain'

import { Blocks } from '@/blocks/index.js'
import { Entry, basalEntry } from '@/entry/basal/index.js'
import type { EntryData } from '@/entry/interface.js'
import { Identity, basalIdentity } from '@/identity/basal/index.js'

import { fixtPath, getTestPaths, names } from './utils/constants.js'
import { getTestIpfs, offlineIpfsOptions } from './utils/ipfs.js'
import { getTestIdentities, getTestIdentity, kpi } from './utils/identities.js'
import { getTestLibp2p } from './utils/libp2p.js'

const testName = 'basal entry'

describe(testName, () => {
  let ipfs: Helia,
    blocks: Blocks,
    identity: Identity,
    entry: Entry,
    invalidEntry: Entry,
    identities: LevelDatastore,
    keychain: KeyChain

  const expectedProtocol = '/hldb/entry/basal'
  const name = names.name0

  const tag = new Uint8Array()
  const payload = {}
  const next: CID[] = []
  const refs: CID[] = []
  const entryModule = basalEntry()
  const identityModule = basalIdentity()

  before(async () => {
    const testPaths = getTestPaths(fixtPath, testName)

    ipfs = await getTestIpfs(testPaths, offlineIpfsOptions)
    blocks = new Blocks(ipfs)

    identities = await getTestIdentities(testPaths)
    const libp2p = await getTestLibp2p(ipfs)
    keychain = libp2p.keychain

    identity = await identityModule.import({
      name,
      identities,
      keychain,
      kpi
    }).catch(async () => await identityModule.get({ name, identities, keychain }))
  })

  after(async () => {
    await ipfs.stop()
  })

  describe('Class', () => {
    it('exposes static properties', () => {
      assert.isOk(entryModule.create)
      assert.isOk(entryModule.fetch)
      assert.isOk(entryModule.asEntry)
      assert.isOk(entryModule.verify)
    })

    it(`.type is equal to '${expectedProtocol}'`, () => {
      assert.strictEqual(entryModule.protocol, expectedProtocol)
    })

    it('.create returns a new entry', async () => {
      entry = await entryModule.create({ identity, tag, payload, next, refs })
      assert.strictEqual(entry.identity, identity)
      assert.deepEqual(entry.tag, tag)
      assert.deepEqual(entry.payload, payload)
      assert.deepEqual(entry.next, next)
      assert.deepEqual(entry.refs, refs)
      assert.strictEqual(
        entry.cid.toString(base32),
        'bafyreifmxzc4qcntuwdc4lw3rukieuzb5n4rbrkirfcwsesmsgbdc6al5i'
      )
    })

    it('.fetch grabs an existing entry', async () => {
      await blocks.put(entry.block)
      await blocks.put(identity.block)
      const _entry = await entryModule.fetch({ blocks, identityModule, cid: entry.cid })
      assert.notStrictEqual(_entry, entry)
      assert.deepEqual(_entry.block, entry.block)
      assert.deepEqual(_entry.identity.auth, entry.identity.auth)
    })

    it('.fetch rejects if signature is invalid', async () => {
      const value = { ...entry.block.value, sig: new Uint8Array() }
      const block = await Blocks.encode({ value })
      await blocks.put(block)
      invalidEntry = (await entryModule.asEntry({ block, identity })) as Entry

      const promise = entryModule.fetch({ blocks, identityModule, cid: invalidEntry.cid })
      await assert.isRejected(promise)
    })

    describe('.asEntry', () => {
      it('returns the same instance if possible', async () => {
        const _entry = await entryModule.asEntry(entry)
        assert.strictEqual(_entry, entry)
      })

      it('returns a new instance if necessary', async () => {
        const _entry = await entryModule.asEntry({
          block: entry.block,
          identity: entry.identity
        })
        assert.notStrictEqual(_entry, entry)
        assert.deepEqual(_entry, entry)
      })
    })

    describe('.verify', () => {
      it('verifies entry with valid signature', async () => {
        const verified = await entryModule.verify(entry)
        assert.strictEqual(verified, true)
      })

      it('unverifies entry with invalid signature', async () => {
        const _entry = invalidEntry
        const verified = await entryModule.verify(_entry)
        assert.strictEqual(verified, false)
      })

      it('unverifies entry with mismatched identity', async () => {
        const identity = await getTestIdentity(
          identities,
          keychain,
          names.name1
        )

        const _entry = (await entryModule.asEntry({
          block: entry.block,
          identity
        })) as Entry
        const verified = await entryModule.verify(_entry)
        assert.strictEqual(verified, false)
      })
    })
  })

  describe('Instance', () => {
    it('exposes instance properties', async () => {
      assert.isOk(entry.block)
      assert.isOk(entry.cid)
      assert.isOk(entry.identity)
      assert.isOk(entry.auth)
      assert.isOk(entry.sig)
      assert.isOk(entry.tag)
      assert.isOk(entry.payload)
      assert.isOk(entry.next)
      assert.isOk(entry.refs)
      assert.strictEqual(entry.cid, entry.block.cid)
      assert.strictEqual(entry.auth, entry.block.value.auth)
      assert.strictEqual(entry.sig, entry.block.value.sig)
      const data = await Blocks.decode<EntryData>({
        bytes: entry.block.value.data
      })
      assert.deepEqual(entry.tag, data.value.tag)
      assert.deepEqual(entry.payload, data.value.payload)
      assert.deepEqual(entry.next, data.value.next)
      assert.deepEqual(entry.refs, data.value.refs)
    })
  })
})
