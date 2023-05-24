import { assert } from './utils/chai.js'
import type { Helia } from '@helia/interface'
import type { BlockView } from 'multiformats/interface'

import { Blocks } from '@/blocks/index.js'
import { Manifest, Address } from '@/manifest/index.js'
import { StaticAccess } from '@/access/static/index.js'
import { Entry } from '@/entry/basal/index.js'
import { Identity } from '@/identity/basal/index.js'
import { Keyvalue } from '@/store/keyvalue/index.js'
import { initRegistry } from '../src/registry.js'

import { getTestIpfs, offlineIpfsOptions } from './utils/ipfs.js'
import { getTestPaths, tempPath } from './utils/constants.js'

const testName = 'manifest'

describe(testName, () => {
  let ipfs: Helia, blocks: Blocks, manifest: Manifest

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

  before(async () => {
    const testPaths = getTestPaths(tempPath, testName)
    ipfs = await getTestIpfs(testPaths, offlineIpfsOptions)
    blocks = new Blocks(ipfs)
  })

  after(async () => {
    await ipfs.stop()
  })

  describe('Class', () => {
    describe('.create', () => {
      it('returns a manifest', async () => {
        manifest = await Manifest.create(config)
        // assert.strictEqual(
        //   manifest.block.cid.toString(),
        //   'bafyreidaqbln54tc6zg2n2oylgx7l5nqnbua7lelsvg3zuoxadr4rqvfiq'
        // )
        assert.strictEqual(manifest.meta, undefined)
        assert.deepEqual(manifest.getTag(), manifest.block.cid.bytes)
      })

      it('returns a manifest with a meta field', async () => {
        const meta = 'meta'
        const _manifest = await Manifest.create({ ...config, meta })
        // assert.strictEqual(
        //   _manifest.block.cid.toString(),
        //   'bafyreigyn3jgyyzntuaefrurwqksnbjfzuocgayfnryttnx2hemr2vkrty'
        // )
        assert.strictEqual(_manifest.meta, meta)
        assert.deepEqual(_manifest.getTag(), _manifest.block.cid.bytes)
      })

      it('returns a manifest with a tag field', async () => {
        const tag = new Uint8Array()
        const _manifest = await Manifest.create({ ...config, tag })
        // assert.strictEqual(
        //   _manifest.block.cid.toString(),
        //   'bafyreiajfis5gnuv5eep36ybb4u6u3pophafqcddx3hqgzg2hvpd2er6om'
        // )
        assert.strictEqual(_manifest.meta, undefined)
        assert.deepEqual(_manifest.tag, tag)
        assert.deepEqual(_manifest.getTag(), tag)
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
      //   await assert.isRejected(promise)
      // })
    })

    describe('.asManifest', () => {
      it('returns the same instance if possible', () => {
        const _manifest = Manifest.asManifest(manifest)
        assert.strictEqual(_manifest, manifest)
      })

      it('returns a new instance if necessary', () => {
        const _manifest = Manifest.asManifest({ block: manifest.block })
        assert.deepEqual(_manifest?.block, manifest.block)
      })

      it('returns null if unable to coerce', () => {
        const _manifest = Manifest.asManifest({
          block: false as unknown as BlockView<any>
        })
        assert.strictEqual(_manifest, null)
      })
    })
  })

  describe('Instance', () => {
    it('exposes instance properties', () => {
      assert.isOk(manifest.block)
      // assert.isOk(manifest.version)
      assert.isOk(manifest.name)
      assert.isOk(manifest.store)
      assert.isOk(manifest.access)
      assert.isOk(manifest.entry)
      assert.isOk(manifest.identity)
      assert.isOk(manifest.tag === undefined)
      assert.isOk(manifest.getTag)
      assert.isOk(manifest.address)
      // have to make some properties not enumberable again
      // assert.deepEqual({ ...manifest }, config);
      assert.deepEqual(manifest.address, new Address(manifest.block.cid))
    })
  })
})
