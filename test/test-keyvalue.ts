import path from 'path'
import { strict as assert } from 'assert'
import { IPFS } from 'ipfs'
import { start, stop } from '@libp2p/interfaces/startable'

import { Keyvalue } from '~store/keyvalue/index.js'
import { Replica } from '~database/replica.js'
import { Blocks } from '~blocks/index.js'
import { StaticAccess } from '~access/static/index.js'
import { Entry } from '~entry/basal/index.js'
import { Identity } from '~identity/basal/index.js'
import { initRegistry } from '~registry/index.js'
import { getIpfs, getIdentity } from './utils/index.js'
import { Manifest } from '~manifest/index.js'
import { defaultManifest } from '~utils/index.js'
import { LevelStorage, StorageReturn } from '~storage/index.js'
import { tempPath } from './utils/constants.js'

const registry = initRegistry()

registry.store.add(Keyvalue)
registry.access.add(StaticAccess)
registry.entry.add(Entry)
registry.identity.add(Identity)

describe('Keyvalue', () => {
  let ipfs: IPFS, blocks: Blocks, identity: Identity
  const expectedProtocol = '/opal/store/keyvalue'
  const Storage = async (name: string): Promise<StorageReturn> => await LevelStorage(path.join(tempPath, 'test-keyvalue', name))

  before(async () => {
    ipfs = await getIpfs()
    blocks = new Blocks(ipfs)

    const got = await getIdentity()
    identity = got.identity

    await blocks.put(identity.block)
  })

  after(async () => {
    await ipfs.stop()
  })

  describe('class', () => {
    it('exposes static properties', () => {
      assert.ok(Keyvalue)
      assert.equal(Keyvalue.protocol, expectedProtocol)
    })
  })

  describe('instance', () => {
    let keyvalue: Keyvalue, replica: Replica, manifest: Manifest, access: StaticAccess
    const key = 'key'
    const value = 0

    before(async () => {
      manifest = await Manifest.create({
        ...defaultManifest('name', identity, registry),
        access: {
          protocol: StaticAccess.protocol,
          config: { write: [identity.id] }
        }
      })
      access = new StaticAccess({ manifest })
      await start(access)
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
      keyvalue = new Keyvalue({ manifest, blocks, replica, Storage })
      await start(keyvalue)
    })

    after(async () => {
      await stop(keyvalue)
      await stop(replica)
    })

    it('exposes instance properties', () => {
      assert.ok(keyvalue.start)
      assert.ok(keyvalue.stop)
      assert.ok(keyvalue.events)
      assert.ok(keyvalue.index)
      assert.ok(keyvalue.creators)
      assert.ok(keyvalue.selectors)
      assert.ok(keyvalue.latest)
    })

    describe('update', () => {
      it('sets a key value pair to value', async () => {
        const payload = keyvalue.creators.put(key, value)
        const entry = await replica.write(payload)

        const index = await keyvalue.latest()

        assert.deepEqual(entry.payload, payload)
        assert.equal(await keyvalue.selectors.get(index)(key), value)
      })

      it('deletes a key value pair', async () => {
        const payload = keyvalue.creators.del(key)
        const entry = await replica.write(payload)

        const index = await keyvalue.latest()

        assert.deepEqual(entry.payload, payload)
        assert.equal(await keyvalue.selectors.get(index)(key), undefined)
      })

      it('updates a key value pair to new value', async () => {
        const payload = keyvalue.creators.put(key, value + 1)
        const entry = await replica.write(payload)

        const index = await keyvalue.latest()

        assert.deepEqual(entry.payload, payload)
        assert.equal(await keyvalue.selectors.get(index)(key), value + 1)
      })
    })

    describe('reading persisted state', () => {
      it('can read persisted keyvalue state', async () => {
        await stop(keyvalue)
        await start(keyvalue)

        const index = keyvalue.index

        assert.equal(await keyvalue.selectors.get(index)(key), value + 1)
      })
    })
  })
})
