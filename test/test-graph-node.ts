import { strict as assert } from 'assert'
import { base32 } from 'multiformats/bases/base32'
import type { BlockView } from 'multiformats/interface'

import { initialNode, Node, NodeValue, NodeObj } from '~replica/graph-node.js'

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
      assert.ok(Node.init)
      assert.ok(Node.decode)
      assert.ok(Node.exists)
    })

    describe('.init', () => {
      it('returns a new node', () => {
        const node = newNode
        const init = Node.init()

        assert.deepEqual(init, node)
        assert.notEqual(init.in, node.in)
        assert.notEqual(init.out, node.out)
        assert.equal(init.missing, node.missing)
        assert.equal(init.denied, node.denied)

        assert.deepEqual(init.in, initNode.in)
        assert.deepEqual(init.out, initNode.out)
        assert.notEqual(init.in, initNode.in)
        assert.notEqual(init.out, initNode.out)
        assert.equal(init.missing, initNode.missing)
        assert.equal(init.denied, initNode.denied)

        assert.deepEqual(initNode.in, initialNode.in)
        assert.deepEqual(initNode.out, initialNode.out)
        assert.equal(initNode.missing, initialNode.missing)
        assert.equal(initNode.denied, initialNode.denied)
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
        assert.equal(Node.exists(node), true)
      })
      it('returns false if the node is missing', () => {
        const node = Node.init()
        node.missing = true
        assert.equal(Node.exists(node), false)
      })
      it('returns false if the node is denied', () => {
        const node = Node.init()
        node.denied = true
        assert.equal(Node.exists(node), false)
      })
    })
  })

  describe('instance', () => {
    it('exposes instance properties', () => {
      const node = Node.init()
      assert.ok(node.in)
      assert.ok(node.out)
      assert.equal(node.missing, false)
      assert.equal(node.denied, false)
      assert.ok(node.encode)
    })

    describe('.encode', () => {
      it('returns a Block with a value of NodeValue', async () => {
        const node = Node.init()
        const block: BlockView<NodeValue> = await node.encode()
        assert.equal(Array.isArray(block.value.out), true)
        assert.equal(Array.isArray(block.value.in), true)
        assert.equal(block.value.out.length === 0, true)
        assert.equal(block.value.in.length === 0, true)
        assert.equal(block.value.missing, false)
        assert.equal(block.value.denied, false)
      })
    })
  })
})
