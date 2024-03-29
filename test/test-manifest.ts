import { assert } from 'aegir/chai'
import { getTestPaths, tempPath } from './utils/constants.js'
import { getTestIpfs, offlineIpfsOptions } from './utils/ipfs.js'
import type { GossipHelia } from '@/interface.js'
import type { Blockstore } from 'interface-blockstore'
import type { BlockView } from 'multiformats/interface'
import staticAccessProtocol from '@/access/static/protocol.js'
import basalEntryProtocol from '@/entry/basal/protocol.js'
import basalIdentityProtocol from '@/identity/basal/protocol.js'
import { Manifest, Address } from '@/manifest/index.js'
import keyvalueStoreProtocol from '@/store/keyvalue/protocol.js'

const testName = 'manifest'

describe(testName, () => {
  let ipfs: GossipHelia, blockstore: Blockstore, manifest: Manifest

  const config = {
    name: 'test',
    store: {
      protocol: keyvalueStoreProtocol
    },
    access: {
      protocol: staticAccessProtocol,
      write: []
    },
    entry: {
      protocol: basalEntryProtocol
    },
    identity: {
      protocol: basalIdentityProtocol
    }
  }

  before(async () => {
    const testPaths = getTestPaths(tempPath, testName)
    ipfs = await getTestIpfs(testPaths, offlineIpfsOptions)
    blockstore = ipfs.blockstore
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
        await blockstore.put(manifest.block.cid, manifest.block.bytes)
        const _manifest = await Manifest.fetch({
          blockstore,
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
