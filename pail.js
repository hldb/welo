import repl from 'node:repl'
import { MemoryBlockstore } from 'blockstore-core'
import { ShardBlock, put, get, del } from '@alanshaw/pail'
import { CID } from 'multiformats/cid'
import * as cbor from '@ipld/dag-cbor'
import { sha256 } from 'multiformats/hashes/sha2'

// Initialize a new bucket
const blocks = new MemoryBlockstore() // like https://npm.im/blockstore-core
const init = await ShardBlock.create() // empty root shard
await blocks.put(init.cid, init.bytes)
const cid = CID.create(1, cbor.code, sha256.digest(new Uint8Array()))

// Add a key and value to the bucket
const { root, additions, removals } = await put(blocks, init.cid, 'asdf', cid)

console.log(`new root: ${root}`)

// Process the diff
for (const block of additions) {
  await blocks.put(block.cid, block.bytes)
}
for (const block of removals) {
  await blocks.delete(block.cid)
}

async function impail ({ init, blocks } = {}) {
  init = init || await ShardBlock.create()
  blocks = blocks || new MemoryBlockstore()

  blocks.put(init.cid, init.bytes)
  let root = init.cid

  const handleReturn = (returned) => {
    if (returned instanceof Promise) {
      return returned.then(handleReturn)
    }
    console.log(returned)

    if (returned.additions) {
      for (const block of returned.additions) {
        blocks.put(block.cid, block.bytes)
      }
    }
    if (returned.removals) {
      for (const block of returned.removals) {
        blocks.put(block.cid, block.bytes)
      }
    }

    root = returned.root

    return returned
  }

  const _put = (key, value) => {
    const bytes = cbor.encode(value)
    const hash = sha256.digest(bytes)
    const cid = CID.create(1, cbor.code, hash)

    blocks.put(cid, bytes)
    return put(blocks, root, key, cid).then(handleReturn)
  }

  return {
    get: (key) => handleReturn(get(blocks, root, key)),
    put: _put,
    del: (key) => handleReturn(del(blocks, root, key))
  }
}

global.impail = impail
global.paily = await impail()

repl.start('> ')
