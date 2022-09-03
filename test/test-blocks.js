
import { strict as assert } from 'assert'
import { CID } from 'multiformats/cid'
import * as Block from 'multiformats/block'
import * as codec from '@ipld/dag-cbor'
import { sha256 as hasher } from 'multiformats/hashes/sha2'

import { Blocks } from '../src/blocks.js'

import { getIpfs } from './utils/index.js'

describe('Blocks', () => {
  let block
  const value = new Uint8Array()
  const bytes = new Uint8Array([64])
  const cid = CID.parse('bafyreigdmqpykrgxyaxtlafqpqhzrb7qy2rh75nldvfd4kok6gl47quzvy')
  const code = codec.code

  before(async () => {
    block = await Block.encode({ value, codec, hasher })
  })

  describe('class', () => {
    it('exposes static properties', () => {
      assert.ok(Blocks.encode)
      assert.ok(Blocks.decode)
    })

    describe('encode', () => {
      it('returns a new block instance', async () => {
        const block = await Blocks.encode({ value })

        assert.deepEqual(block.value, value)
        assert.deepEqual(block.bytes, bytes)
        assert.deepEqual(block.cid, cid)
        assert.equal(block.cid.code, code)
      })
    })

    describe('decode', () => {
      it('returns a new block instance', async () => {
        const block = await Blocks.decode({ bytes })

        assert.deepEqual(block.value, value)
        assert.deepEqual(block.bytes, bytes)
        assert.deepEqual(block.cid, cid)
        assert.equal(block.cid.code, code)
      })
    })
  })

  describe('instance', () => {
    let ipfs, blocks

    before(async () => {
      ipfs = await getIpfs()
      blocks = new Blocks(ipfs)
    })

    after(async () => {
      await ipfs.stop()
    })

    it('exposes instance properties', () => {
      assert.ok(blocks.get)
      assert.ok(blocks.put)
      assert.ok(blocks.encode)
      assert.ok(blocks.decode)
      assert.equal(blocks.encode, Blocks.encode)
      assert.equal(blocks.decode, Blocks.decode)
    })

    describe('put', () => {
      it('returns a block from a cid', async () => {
        const cid = await blocks.put(block)

        assert.ok(cid instanceof CID)
        assert.deepEqual(cid, block.cid)
        assert.equal(cid.code, code)
      })
    })

    describe('get', () => {
      it('returns a block from a cid', async () => {
        const block = await blocks.get(cid)

        assert.deepEqual(block.value, value)
        assert.deepEqual(new Uint8Array(block.bytes), bytes)
        assert.deepEqual(block.cid, cid)
        assert.equal(block.cid.code, code)
      })
    })
  })
})
