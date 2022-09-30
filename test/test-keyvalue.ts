import { strict as assert } from 'assert'
import { IPFS } from 'ipfs'
import { start } from '@libp2p/interfaces/startable'

import { Keyvalue } from '../src/store/keyvalue/index.js'

import { Replica } from '../src/database/replica.js'
import { Blocks } from '../src/mods/blocks.js'
import { StaticAccess } from '../src/access/static/index.js'
import { Entry } from '../src/entry/default/index.js'
import { Identity } from '../src/identity/default/index.js'
import { initRegistry } from '../src/registry/index.js'
import { getIpfs, getIdentity } from './utils/index.js'
import { Manifest } from '../src/manifest/default/index.js'
import { defaultManifest } from '../src/utils/index.js'

const registry = initRegistry()

registry.store.add(Keyvalue)
registry.access.add(StaticAccess)
registry.entry.add(Entry)
registry.identity.add(Identity)

describe('Keyvalue', () => {
  let ipfs: IPFS, blocks: Blocks, identity: Identity, keyvalue: Keyvalue
  const expectedProtocol = '/opal/store/keyvalue'

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
      let replica: Replica, manifest: Manifest, access: StaticAccess
      const key = 'key'
      const value = 0

      before(async () => {
        manifest = await Manifest.create({
          ...defaultManifest('name', identity, registry),
          access: { protocol: StaticAccess.protocol, config: { write: [identity.id] } }
        })
        access = new StaticAccess({ manifest })
        await start(access)
        replica = new Replica({
          manifest,
          blocks,
          access,
          identity,
          Entry,
          Identity
        })
        await start(replica)
      })

      after(async () => {
        await replica.close()
      })

      it('sets a key value pair to value', async () => {
        const payload = keyvalue.creators.put(key, value)
        const entry = await replica.write(payload)

        const index = await keyvalue.latest()

        assert.deepEqual(entry.payload, payload)
        assert.equal(keyvalue.selectors.get(index)(key), value)
      })

      it('updates a key value pair to new value', async () => {
        const payload = keyvalue.creators.put(key, value + 1)
        const entry = await replica.write(payload)

        const index = await keyvalue.latest()

        assert.deepEqual(entry.payload, payload)
        assert.equal(keyvalue.selectors.get(index)(key), value + 1)
      })

      it('deletes a key value pair', async () => {
        const payload = keyvalue.creators.del(key)
        const entry = await replica.write(payload)

        const index = await keyvalue.latest()

        assert.deepEqual(entry.payload, payload)
        assert.equal(keyvalue.selectors.get(index)(key), undefined)
      })
    })
  })
})
