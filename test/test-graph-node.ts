import { strict as assert } from 'assert'
import { Node, NodeObj } from '../src/database/graph.js'

describe('Graph Node', () => {
  const initialNode: NodeObj = {
    in: new Set(),
    out: new Set(),
    miss: false,
    deny: false
  }
  const newNode = new Node(initialNode)
  const mutatedNode = new Node({
    ...initialNode,
    in: new Set(['3']),
    out: new Set(['1'])
  })
  const missNode = new Node({
    ...initialNode,
    miss: true
  })
  const denyNode = new Node({
    ...initialNode,
    deny: true
  })

  describe('class', () => {
    it('exposes static properties', () => {
      assert.ok(Node.init)
      assert.ok(Node.clone)
    })

    describe('.init', () => {
      it('returns a new node', () => {
        const node = newNode
        const init = Node.init()
        assert.deepEqual(init, node)
        assert.notEqual(init.in, node.in)
        assert.notEqual(init.out, node.out)
        assert.equal(init.miss, node.miss)
        assert.equal(init.deny, node.deny)

        assert.deepEqual(init.in, initialNode.in)
        assert.deepEqual(init.out, initialNode.out)
        assert.notEqual(init.in, initialNode.in)
        assert.notEqual(init.out, initialNode.out)
        assert.equal(init.miss, initialNode.miss)
        assert.equal(init.deny, initialNode.deny)
      })
    })

    describe('.clone', () => {
      it('returns a cloned new node', () => {
        const node = newNode
        const clone = Node.clone(node)
        assert.deepEqual(clone, node)
        assert.notEqual(clone.in, node.in)
        assert.notEqual(clone.out, node.out)
        assert.equal(clone.miss, node.miss)
        assert.equal(clone.deny, node.deny)

        assert.deepEqual(clone.in, new Set())
        assert.deepEqual(clone.out, new Set())
        assert.equal(clone.miss, false)
        assert.equal(clone.deny, false)
      })

      it('returns a cloned mutated node', () => {
        const node = mutatedNode
        const clone = Node.clone(node)
        assert.deepEqual(clone, node)
        assert.notEqual(clone.in, node.in)
        assert.notEqual(clone.out, node.out)
        assert.equal(clone.miss, node.miss)
        assert.equal(clone.deny, node.deny)

        assert.deepEqual(clone.in, new Set(['3']))
        assert.deepEqual(clone.out, new Set(['1']))
        assert.equal(clone.miss, false)
        assert.equal(clone.deny, false)
      })

      it('returns a cloned missing node', () => {
        const node = missNode
        const clone = Node.clone(node)
        assert.deepEqual(clone, node)
        assert.notEqual(clone.in, node.in)
        assert.notEqual(clone.out, node.out)
        assert.equal(clone.miss, node.miss)
        assert.equal(clone.deny, node.deny)

        assert.deepEqual(clone.in, new Set())
        assert.deepEqual(clone.out, new Set())
        assert.equal(clone.miss, true)
        assert.equal(clone.deny, false)
      })

      it('returns a cloned denied node', () => {
        const node = denyNode
        const clone = Node.clone(node)
        assert.deepEqual(clone, node)
        assert.notEqual(clone.in, node.in)
        assert.notEqual(clone.out, node.out)
        assert.equal(clone.miss, node.miss)
        assert.equal(clone.deny, node.deny)

        assert.deepEqual(clone.in, new Set())
        assert.deepEqual(clone.out, new Set())
        assert.equal(clone.miss, false)
        assert.equal(clone.deny, true)
      })
    })
  })

  describe('instance', () => {
    it('exposes instance properties', () => {
      const node = Node.init()
      assert.ok(node.in)
      assert.ok(node.out)
      assert.equal(node.miss, false)
      assert.equal(node.deny, false)
    })
  })
})
