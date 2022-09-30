import { strict as assert } from 'assert'
import { IPFS } from 'ipfs'
import { Block } from 'multiformats/block'

import { Blocks } from '../src/mods/blocks.js'
import { Manifest, Address } from '../src/manifest/default/index.js'
import { StaticAccess } from '../src/access/static/index.js'
import { Entry } from '../src/entry/default/index.js'
import { Identity } from '../src/identity/default/index.js'
import { Keyvalue } from '../src/store/keyvalue/index.js'
import { initRegistry } from '../src/registry/index.js'
import { getComponents } from '../src/utils/index.js'

import { getIpfs } from './utils/index.js'

const registry = initRegistry()
registry.store.add(Keyvalue)
registry.access.add(StaticAccess)
registry.entry.add(Entry)
registry.identity.add(Identity)

const config = {
  name: 'test',
  store: {
    protocol: registry.store.star.protocol
  },
  access: {
    protocol: registry.access.star.protocol,
    write: []
  },
  entry: {
    protocol: registry.entry.star.protocol
  },
  identity: {
    protocol: registry.identity.star.protocol
  }
}

describe('Manifest', () => {
  let ipfs: IPFS, blocks: Blocks, manifest: Manifest

  before(async () => {
    ipfs = await getIpfs()
    blocks = new Blocks(ipfs)
  })

  after(async () => {
    await ipfs.stop()
  })

  describe('Class', () => {
    describe('.create', () => {
      it('returns a manifest', async () => {
        manifest = await Manifest.create(config)
        assert.equal(
          manifest.block.cid.toString(),
          'bafyreihtia76lhsj6y4fn4q7nwwvgg46umsulqde4dnmpnk7z6mrl4qq5q'
        )
        assert.equal(manifest.meta, undefined)
        assert.deepEqual(manifest.getTag, manifest.block.cid.bytes)
      })

      it('returns a manifest with a meta field', async () => {
        const meta = 'meta'
        const _manifest = await Manifest.create({ ...config, meta })
        assert.equal(
          _manifest.block.cid.toString(),
          'bafyreidmyhpdg3lzzylyhznfa2fqerpq32f4bjn5wqfbg6icqn4f6p4nju'
        )
        assert.equal(_manifest.meta, meta)
        assert.deepEqual(_manifest.getTag, _manifest.block.cid.bytes)
      })

      it('returns a manifest with a tag field', async () => {
        const tag = new Uint8Array()
        const _manifest = await Manifest.create({ ...config, tag })
        assert.equal(
          _manifest.block.cid.toString(),
          'bafyreibzyfs4xxtpuxsphpq2xaz7rrhqwtsjyrxpq6qsk4mepbbdiezkb4'
        )
        assert.equal(_manifest.meta, undefined)
        assert.deepEqual(_manifest.tag, tag)
        assert.deepEqual(_manifest.getTag, tag)
      })
    })

    describe('.fetch', () => {
      it('returns a manifest from an address', async () => {
        await blocks.put(manifest.block)
        const _manifest = await Manifest.fetch({
          blocks,
          address: manifest.address
        })
        // ipfs block api returns Buffers in nodejs which become block.bytes
        // assert.deepEqual(_manifest.block, manifest.block)
        assert.deepEqual(_manifest.block.cid, manifest.block.cid)
      })

      // can't add this yet, no runtime schema checks
      // it('throws if address did not resolve to a manifest', async () => {
      //   const block = await Blocks.encode({ value: 'not a manifest' })
      //   await blocks.put(block)
      //   const address = new Address(block.cid)
      //   const promise = Manifest.fetch({ blocks, address })
      //   await assert.rejects(promise)
      // })
    })

    describe('.asManifest', () => {
      it('returns the same instance if possible', () => {
        const _manifest = Manifest.asManifest(manifest)
        assert.equal(_manifest, manifest)
      })

      it('returns a new instance if necessary', () => {
        const _manifest = Manifest.asManifest({ block: manifest.block })
        assert.deepEqual(_manifest?.block, manifest.block)
      })

      it('returns null if unable to coerce', () => {
        const _manifest = Manifest.asManifest({ block: false as unknown as Block<any> })
        assert.equal(_manifest, null)
      })
    })

    describe('.getComponents', () => {
      it('returns the components for the manifest', () => {
        const components = getComponents(registry, manifest)
        assert.equal(components.Store, Keyvalue)
        assert.equal(components.Access, StaticAccess)
        assert.equal(components.Entry, Entry)
        assert.equal(components.Identity, Identity)
      })
    })
  })

  describe('Instance', () => {
    it('exposes instance properties', () => {
      assert.ok(manifest.block)
      // assert.ok(manifest.version)
      assert.ok(manifest.name)
      assert.ok(manifest.store)
      assert.ok(manifest.access)
      assert.ok(manifest.entry)
      assert.ok(manifest.identity)
      assert.ok(manifest.tag === undefined)
      assert.ok(manifest.getTag)
      assert.ok(manifest.address)
      // have to make some properties not enumberable again
      // assert.deepEqual({ ...manifest }, config);
      assert.deepEqual(manifest.address, new Address(manifest.block.cid))
    })
  })
})
