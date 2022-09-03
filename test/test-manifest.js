
import { strict as assert } from 'assert'

import { Blocks } from '../src/blocks.js'
import { Manifest, Address } from '../src/manifest/index.js'
import { StaticAccess } from '../src/manifest/access/static.js'
import { Entry } from '../src/manifest/entry/index.js'
import { Identity } from '../src/manifest/identity/index.js'
import { Keyvalue } from '../src/manifest/store/keyvalue.js'
import { Register } from '../src/register.js'

import { getIpfs } from './utils/index.js'

const registry = Object.fromEntries([
  'store',
  'access',
  'entry',
  'identity'
].map(k => [k, new Register()]))
registry.store.add(Keyvalue)
registry.access.add(StaticAccess)
registry.entry.add(Entry)
registry.identity.add(Identity)

const config = {
  name: 'test',
  store: {
    type: registry.store.star.type
  },
  access: {
    type: registry.access.star.type,
    write: []
  },
  entry: {
    type: registry.entry.star.type
  },
  identity: {
    type: registry.identity.star.type
  }
}

describe('Manifest', () => {
  let ipfs, blocks, manifest

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
        assert.equal(manifest.block.cid.toString(), 'bafyreihemmmd2fw2xziuyk3i7ifafkjo7hjlvjjfz5nvxman5ik33pzfpm')
        assert.equal(manifest.meta, undefined)
        assert.equal(manifest.tag, manifest.block.cid.multihash.digest)
      })

      it('returns a manifest with a meta field', async () => {
        const meta = 'meta'
        const _manifest = await Manifest.create({ ...config, meta })
        assert.equal(_manifest.block.cid.toString(), 'bafyreid4hlz7bzlvojqux53opnnx2yatrgknbntznycqvgmp5bwuzofjni')
        assert.equal(_manifest.meta, meta)
        assert.equal(_manifest.tag, _manifest.block.cid.multihash.digest)
      })

      it('returns a manifest with a tag field', async () => {
        const tag = new Uint8Array()
        const _manifest = await Manifest.create({ ...config, tag })
        assert.equal(_manifest.block.cid.toString(), 'bafyreidsqmalkuv2emaknt6d3gg2joamgm6abiddc4f4bwkg2brzir2qba')
        assert.equal(_manifest.meta, undefined)
        assert.deepEqual(_manifest.tag, tag)
      })
    })

    describe('.fetch', () => {
      it('returns a manifest from an address', async () => {
        await blocks.put(manifest.block)
        const _manifest = await Manifest.fetch({ blocks, address: manifest.address })
        // ipfs block api returns Buffers in nodejs which become block.bytes
        // assert.deepEqual(_manifest.block, manifest.block)
        assert.deepEqual(_manifest.block.cid, manifest.block.cid)
      })
    })

    describe('.asManifest', async () => {
      it('returns the same instance if possible', async () => {
        const _manifest = await Manifest.asManifest(manifest)
        assert.equal(_manifest, manifest)
      })

      it('returns a new instance if necessary', async () => {
        const _manifest = await Manifest.asManifest({ block: manifest.block })
        assert.deepEqual(_manifest.block, manifest.block)
      })

      it('returns null if unable to coerce', async () => {
        const _manifest = await Manifest.asManifest({ block: false })
        assert.equal(_manifest, null)
      })

      it('rejects if unable to coerce and forced', async () => {
        assert.rejects(() => Manifest.asManifest({ block: false }, true))
      })
    })

    describe('.getComponents', () => {
      it('returns the components for the manifest', () => {
        const components = Manifest.getComponents(registry, manifest)
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
      assert.ok(manifest.tag)
      assert.ok(manifest.address)
      assert.deepEqual({ ...manifest }, config)
      assert.deepEqual(manifest.address, new Address(manifest.block.cid))
    })
  })
})
