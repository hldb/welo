import { assert } from 'aegir/chai'
import { base32 } from 'multiformats/bases/base32'
import type { BlockView } from 'multiformats/interface'

import { initialNode, Node, NodeValue, NodeObj } from '@/replica/graph-node.js'

describe('Graph Node', () => {
  const initNode: NodeObj = {
    in: new Set(),
    out: new Set(),
    missing: false,
    denied: false
  }
  const newNode = new Node(initialNode)

  describe('initialNode', () => {
    it('exposes NodeObj interface', () => {
      assert.deepEqual(initialNode, initNode)
    })
  })

  describe('class', () => {
    it('exposes static properties', () => {
      assert.isOk(Node.init)
      assert.isOk(Node.decode)
      assert.isOk(Node.exists)
    })

    describe('.init', () => {
      it('returns a new node', () => {
        const node = newNode
        const init = Node.init()

        assert.deepEqual(init, node)
        assert.notStrictEqual(init.in, node.in)
        assert.notStrictEqual(init.out, node.out)
        assert.strictEqual(init.missing, node.missing)
        assert.strictEqual(init.denied, node.denied)

        assert.deepEqual(init.in, initNode.in)
        assert.deepEqual(init.out, initNode.out)
        assert.notStrictEqual(init.in, initNode.in)
        assert.notStrictEqual(init.out, initNode.out)
        assert.strictEqual(init.missing, initNode.missing)
        assert.strictEqual(init.denied, initNode.denied)

        assert.deepEqual(initNode.in, initialNode.in)
        assert.deepEqual(initNode.out, initialNode.out)
        assert.strictEqual(initNode.missing, initialNode.missing)
        assert.strictEqual(initNode.denied, initialNode.denied)
      })
    })

    describe('.decode', () => {
      it('returns a Node from byte encoding', async () => {
        const bytes = base32.decode(
          'burrgs3uamnxxk5eamzsgk3tjmvspiz3nnfzxg2lom72a'
        )
        const node = await Node.decode(bytes)
        assert.deepEqual(node, newNode)
      })
    })

    describe('.exists', () => {
      it('returns true if the node is not missing or denied', () => {
        const node = Node.init()
        assert.strictEqual(Node.exists(node), true)
      })
      it('returns false if the node is missing', () => {
        const node = Node.init()
        node.missing = true
        assert.strictEqual(Node.exists(node), false)
      })
      it('returns false if the node is denied', () => {
        const node = Node.init()
        node.denied = true
        assert.strictEqual(Node.exists(node), false)
      })
    })
  })

  describe('instance', () => {
    it('exposes instance properties', () => {
      const node = Node.init()
      assert.isOk(node.in)
      assert.isOk(node.out)
      assert.strictEqual(node.missing, false)
      assert.strictEqual(node.denied, false)
      assert.isOk(node.encode)
    })

    describe('.encode', () => {
      it('returns a Block with a value of NodeValue', async () => {
        const node = Node.init()
        const block: BlockView<NodeValue> = await node.encode()
        assert.strictEqual(Array.isArray(block.value.out), true)
        assert.strictEqual(Array.isArray(block.value.in), true)
        assert.strictEqual(block.value.out.length === 0, true)
        assert.strictEqual(block.value.in.length === 0, true)
        assert.strictEqual(block.value.missing, false)
        assert.strictEqual(block.value.denied, false)
      })
    })
  })
})
