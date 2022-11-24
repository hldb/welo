import { strict as assert } from 'assert'
import type { IPFS } from 'ipfs'
import type { CID } from 'multiformats/cid'
import { base32 } from 'multiformats/bases/base32'
import type { Datastore } from 'interface-datastore'

import { Blocks } from '~blocks/index.js'
import { Entry } from '~entry/basal/index.js'
import type { EntryData } from '~entry/interface.js'
import { Identity } from '~identity/basal/index.js'
import type { KeyChain } from '~utils/types.js'

import { fixtPath, getTestPaths, names } from './utils/constants.js'
import { getTestIpfs, offlineIpfsOptions } from './utils/ipfs.js'
import { getTestIdentities, getTestIdentity, kpi } from './utils/identities.js'
import { getTestLibp2p } from './utils/libp2p.js'

const testName = 'basal entry'

describe(testName, () => {
  let ipfs: IPFS,
    blocks: Blocks,
    identity: Identity,
    entry: Entry,
    invalidEntry: Entry,
    identities: Datastore,
    keychain: KeyChain

  const expectedProtocol = '/opal/entry'
  const name = names.name0

  const tag = new Uint8Array()
  const payload = {}
  const next: CID[] = []
  const refs: CID[] = []

  before(async () => {
    const testPaths = getTestPaths(fixtPath, testName)

    ipfs = await getTestIpfs(testPaths, offlineIpfsOptions)
    blocks = new Blocks(ipfs)

    identities = await getTestIdentities(testPaths)
    const libp2p = await getTestLibp2p(ipfs)
    keychain = libp2p.keychain

    identity = await Identity.import({
      name,
      identities,
      keychain,
      kpi
    }).catch(async (e) => await Identity.get({ name, identities, keychain }))
  })

  after(async () => {
    await ipfs.stop()
  })

  describe('Class', () => {
    it('exposes static properties', () => {
      assert.ok(Entry.protocol)
      assert.ok(Entry.create)
      assert.ok(Entry.fetch)
      assert.ok(Entry.asEntry)
      assert.ok(Entry.verify)
    })

    it(`.type is equal to '${expectedProtocol}'`, () => {
      assert.equal(Entry.protocol, expectedProtocol)
    })

    it('.create returns a new entry', async () => {
      entry = await Entry.create({ identity, tag, payload, next, refs })
      assert.equal(entry.identity, identity)
      assert.deepEqual(entry.tag, tag)
      assert.deepEqual(entry.payload, payload)
      assert.deepEqual(entry.next, next)
      assert.deepEqual(entry.refs, refs)
      assert.equal(
        entry.cid.toString(base32),
        'bafyreifmxzc4qcntuwdc4lw3rukieuzb5n4rbrkirfcwsesmsgbdc6al5i'
      )
    })

    it('.fetch grabs an existing entry', async () => {
      await blocks.put(entry.block)
      await blocks.put(identity.block)
      const _entry = await Entry.fetch({ blocks, Identity, cid: entry.cid })
      assert.notEqual(_entry, entry)
      assert.deepEqual(_entry.block, entry.block)
      assert.deepEqual(_entry.identity.auth, entry.identity.auth)
    })

    it('.fetch rejects if signature is invalid', async () => {
      const value = { ...entry.block.value, sig: new Uint8Array() }
      const block = await Blocks.encode({ value })
      await blocks.put(block)
      invalidEntry = (await Entry.asEntry({ block, identity })) as Entry

      const promise = Entry.fetch({ blocks, Identity, cid: invalidEntry.cid })
      await assert.rejects(promise)
    })

    describe('.asEntry', () => {
      it('returns the same instance if possible', async () => {
        const _entry = await Entry.asEntry(entry)
        assert.equal(_entry, entry)
      })

      it('returns a new instance if necessary', async () => {
        const _entry = await Entry.asEntry({
          block: entry.block,
          identity: entry.identity
        })
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
        const _entry = invalidEntry
        const verified = await Entry.verify(_entry)
        assert.equal(verified, false)
      })

      it('unverifies entry with mismatched identity', async () => {
        const identity = await getTestIdentity(
          identities,
          keychain,
          names.name1
        )

        const _entry = (await Entry.asEntry({
          block: entry.block,
          identity
        })) as Entry
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
      assert.ok(entry.tag)
      assert.ok(entry.payload)
      assert.ok(entry.next)
      assert.ok(entry.refs)
      assert.equal(entry.cid, entry.block.cid)
      assert.equal(entry.auth, entry.block.value.auth)
      assert.equal(entry.sig, entry.block.value.sig)
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
