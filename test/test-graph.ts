import { strict as assert } from 'assert'
import type { IPFS } from 'ipfs'
import { CID } from 'multiformats/cid.js'
import { start } from '@libp2p/interfaces/startable'

import { Graph } from '../src/database/graph.js'
import { Node } from '../src/database/graph-node.js'
import { Blocks } from '../src/blocks/index.js'
import { getIpfs } from './utils/index.js'

describe('Graph', () => {
  let ipfs: IPFS, blocks: Blocks

  let nodes: CID[], missing: CID[], denied: CID[]
  const initNode = Node.init()
  const muteNode = ({
    in: ni,
    out
  }: { in?: Set<string>, out?: Set<string> } = {}): Node =>
    new Node({
      ...initNode,
      in: ni != null ? ni : new Set(),
      out: out != null ? out : new Set()
    })
  const missingNode = ({ in: ni }: { in: Set<string> }): Node =>
    new Node({ ...muteNode({ in: ni }), missing: true })
  const deniedNode = ({ in: ni }: { in: Set<string> }): Node =>
    new Node({ ...muteNode({ in: ni }), denied: true })

  before(async () => {
    ipfs = await getIpfs()
    blocks = new Blocks(ipfs)

    // make 8 of each cid
    nodes = []
    missing = []
    denied = []
    for (let i = 0; i < 8; i++) {
      const { cid: node } = await Blocks.encode({ value: { node: true, i } })
      const { cid: miss } = await Blocks.encode({ value: { miss: true, i } })
      const { cid: deny } = await Blocks.encode({ value: { deny: true, i } })
      nodes.push(node)
      missing.push(miss)
      denied.push(deny)
    }
  })

  after(async () => {
    await ipfs.stop()
  })

  describe('class', () => {
    describe('constructor', () => {
      it('returns instance', () => {
        const graph = new Graph({ blocks })
        assert.equal(graph.blocks, blocks)
        assert.equal(graph._root, null)
      })

      it('returns instance using provided root', () => {
        // const root = {}
        // const graph = new Graph({ blocks, root })
        // assert.equal(graph.blocks, blocks)
        // assert.equal(graph._root, root)
      })
    })
  })

  describe('instance', () => {
    it('exposes instance properties', async () => {
      const graph = new Graph({ blocks })

      assert.equal(graph._root, null)
      assert.equal(graph._state, null)
      assert.ok(graph.known)
      assert.ok(graph.get)
      assert.ok(graph.has)
      assert.ok(graph.size)
      assert.ok(graph.add)
      assert.ok(graph.miss)
      assert.ok(graph.deny)

      await start(graph)

      assert.ok(graph.state)
      assert.ok(graph.root)
      assert.ok(graph.nodes)
      assert.ok(graph.heads)
      assert.ok(graph.tails)
      assert.ok(graph.missing)
      assert.ok(graph.denied)
    })

    describe('add', () => {
      it('adds a cid to an empty graph', async () => {
        const graph = new Graph({ blocks })
        await start(graph)

        const cid = nodes[0]
        const out: CID[] = []

        await graph.add(cid, out)

        assert.equal(await graph.size(), 1)
        assert.equal(await graph.nodes.size(), 1)
        assert.deepEqual(await graph.get(cid), muteNode())

        assert.equal(await graph.heads.size(), 1)
        assert.equal(await graph.heads.has(cid.toString()), true)

        assert.equal(await graph.tails.size(), 1)
        assert.equal(await graph.tails.has(cid.toString()), true)

        assert.equal(await graph.missing.size(), 0)
        assert.equal(await graph.denied.size(), 0)
      })

      it('adds a cid to a graph and references an unknown node', async () => {
        const graph = new Graph({ blocks })
        await start(graph)

        const cid0 = nodes[0]
        const out0 = [missing[0]]

        await graph.add(cid0, out0)

        assert.equal(await graph.size(), 1)
        assert.equal(await graph.nodes.size(), 2)
        assert.deepEqual(
          await graph.get(cid0),
          muteNode({ out: new Set([missing[0].toString()]) })
        )
        assert.deepEqual(
          await graph.get(missing[0]),
          missingNode({ in: new Set([cid0.toString()]) })
        )

        assert.equal(await graph.heads.size(), 1)
        assert.equal(await graph.heads.has(cid0.toString()), true)

        assert.equal(await graph.tails.size(), 1)
        assert.equal(await graph.tails.has(cid0.toString()), true)

        assert.equal(await graph.missing.size(), 1)
        assert.equal(await graph.missing.has(missing[0].toString()), true)

        assert.equal(await graph.denied.size(), 0)
      })

      it('adds a cid to a graph and references an existing node', async () => {
        const graph = new Graph({ blocks })
        await start(graph)

        const cid0 = nodes[0]
        const out0: CID[] = []

        await graph.add(cid0, out0)

        const cid1 = nodes[1]
        const out1 = [cid0]

        await graph.add(cid1, out1)

        assert.equal(await graph.size(), 2)
        assert.equal(await graph.nodes.size(), 2)
        assert.deepEqual(
          await graph.get(cid0),
          muteNode({ in: new Set([cid1.toString()]) })
        )
        assert.deepEqual(
          await graph.get(cid1),
          muteNode({ out: new Set([cid0.toString()]) })
        )

        assert.equal(await graph.heads.size(), 1)
        assert.equal(await graph.heads.has(cid1.toString()), true)

        assert.equal(await graph.tails.size(), 1)
        assert.equal(await graph.tails.has(cid0.toString()), true)

        assert.equal(await graph.missing.size(), 0)
        assert.equal(await graph.denied.size(), 0)
      })

      it('adds a cid to a graph and references a missing node', async () => {
        const graph = new Graph({ blocks })
        await start(graph)

        const cid0 = nodes[0]
        const out0 = [missing[0]]

        await graph.add(cid0, out0)

        const cid1 = nodes[1]

        await graph.add(cid1, out0)

        assert.equal(await graph.size(), 2)
        assert.equal(await graph.nodes.size(), 3)
        assert.deepEqual(
          await graph.get(cid0),
          muteNode({ out: new Set([missing[0].toString()]) })
        )
        assert.deepEqual(
          await graph.get(cid1),
          muteNode({ out: new Set([missing[0].toString()]) })
        )
        assert.deepEqual(
          await graph.get(missing[0]),
          missingNode({ in: new Set([cid0.toString(), cid1.toString()]) })
        )

        assert.equal(await graph.heads.size(), 2)
        assert.equal(await graph.heads.has(cid1.toString()), true)

        assert.equal(await graph.tails.size(), 2)
        assert.equal(await graph.tails.has(cid0.toString()), true)

        assert.equal(await graph.missing.size(), 1)
        assert.equal(await graph.missing.has(missing[0].toString()), true)

        assert.equal(await graph.denied.size(), 0)
      })

      it('adds a cid to a graph and references a denied node', async () => {
        const graph = new Graph({ blocks })
        await start(graph)

        const cid0 = denied[0]
        const out0: CID[] = []

        await graph.add(cid0, out0)

        const cid1 = nodes[1]
        const out1 = [cid0]

        await graph.add(cid1, out1)
        await graph.deny(cid0)

        const cid2 = nodes[2]
        const out2 = [cid0]

        await graph.add(cid2, out2)

        assert.equal(await graph.size(), 2)
        assert.equal(await graph.nodes.size(), 3)
        assert.deepEqual(
          await graph.get(cid0),
          deniedNode({ in: new Set([cid1.toString(), cid2.toString()]) })
        )
        assert.deepEqual(
          await graph.get(cid1),
          muteNode({ out: new Set([cid0.toString()]) })
        )
        assert.deepEqual(
          await graph.get(cid2),
          muteNode({ out: new Set([cid0.toString()]) })
        )

        assert.equal(await graph.heads.size(), 2)
        assert.equal(await graph.heads.has(cid1.toString()), true)
        assert.equal(await graph.heads.has(cid2.toString()), true)

        assert.equal(await graph.tails.size(), 2)
        assert.equal(await graph.tails.has(cid1.toString()), true)
        assert.equal(await graph.tails.has(cid2.toString()), true)

        assert.equal(await graph.missing.size(), 0)

        assert.equal(await graph.denied.size(), 1)
        assert.equal(await graph.denied.has(cid0.toString()), true)
      })

      it('does not overwrite an added node for an existing cid in a graph', async () => {
        const graph = new Graph({ blocks })
        await start(graph)

        const cid0 = nodes[0]
        const out0: CID[] = []

        await graph.add(cid0, out0)
        const node0 = await graph.get(cid0)

        const cid1 = nodes[0]
        const out1: CID[] = []

        await graph.add(cid1, out1)
        const node1 = await graph.get(cid1)

        assert.equal(await graph.size(), 1)
        assert.equal(await graph.nodes.size(), 1)
        assert.deepEqual(await graph.get(cid0), node1)
        assert.deepEqual(await graph.get(cid1), node0)

        assert.equal(await graph.heads.size(), 1)
        assert.equal(await graph.heads.has(cid0.toString()), true)
        assert.equal(await graph.heads.has(cid1.toString()), true)

        assert.equal(await graph.tails.size(), 1)
        assert.equal(await graph.tails.has(cid0.toString()), true)
        assert.equal(await graph.tails.has(cid1.toString()), true)

        assert.equal(await graph.missing.size(), 0)

        assert.equal(await graph.denied.size(), 0)
      })

      it('overwrites a node for a missing cid in a graph', async () => {
        const graph = new Graph({ blocks })
        await start(graph)

        const cid0 = nodes[0]
        const out0: CID[] = []

        const cid1 = nodes[1]
        const out1 = [cid0]

        await graph.add(cid1, out1)
        await graph.add(cid0, out0)

        assert.equal(await graph.size(), 2)
        assert.equal(await graph.nodes.size(), 2)
        assert.deepEqual(
          await graph.get(cid0),
          muteNode({ in: new Set([cid1.toString()]) })
        )
        assert.deepEqual(
          await graph.get(cid1),
          muteNode({ out: new Set([cid0.toString()]) })
        )

        assert.equal(await graph.heads.size(), 1)
        assert.equal(await graph.heads.has(cid1.toString()), true)

        assert.equal(await graph.tails.size(), 1)
        assert.equal(await graph.tails.has(cid0.toString()), true)

        assert.equal(await graph.missing.size(), 0)

        assert.equal(await graph.denied.size(), 0)
      })

      it('overwrites a node for a denied cid in a graph', async () => {
        const graph = new Graph({ blocks })
        await start(graph)

        const cid0 = nodes[0]
        const out0: CID[] = []

        const cid1 = nodes[1]
        const out1 = [cid0]

        await graph.add(cid0, out0)
        await graph.add(cid1, out1)
        await graph.deny(cid0)
        await graph.add(cid0, out0)

        assert.equal(await graph.size(), 2)
        assert.equal(await graph.nodes.size(), 2)
        assert.deepEqual(
          await graph.get(cid0),
          muteNode({ in: new Set([cid1.toString()]) })
        )
        assert.deepEqual(
          await graph.get(cid1),
          muteNode({ out: new Set([cid0.toString()]) })
        )

        assert.equal(await graph.heads.size(), 1)
        assert.equal(await graph.heads.has(cid1.toString()), true)

        assert.equal(await graph.tails.size(), 1)
        assert.equal(await graph.tails.has(cid0.toString()), true)

        assert.equal(await graph.missing.size(), 0)

        assert.equal(await graph.denied.size(), 0)
      })

      it('handles self-reference cids in out', async () => {
        const graph = new Graph({ blocks })
        await start(graph)

        const cid0 = nodes[0]
        const out0: CID[] = [cid0]

        await graph.add(cid0, out0)

        assert.equal(await graph.size(), 1)
        assert.equal(await graph.nodes.size(), 1)
        assert.deepEqual(await graph.get(cid0), muteNode())

        assert.equal(await graph.heads.size(), 1)
        assert.equal(await graph.heads.has(cid0.toString()), true)

        assert.equal(await graph.tails.size(), 1)
        assert.equal(await graph.tails.has(cid0.toString()), true)

        assert.equal(await graph.missing.size(), 0)

        assert.equal(await graph.denied.size(), 0)
      })
    })

    // miss and deny tests can be very similar as they both use await graph._rm

    describe('miss', () => {
      it('does not add a missing cid to an empty graph', async () => {
        const graph = new Graph({ blocks })
        await start(graph)

        const cid0 = missing[0]

        await graph.miss(cid0)

        assert.equal(await graph.size(), 0)
        assert.equal(await graph.heads.size(), 0)
        assert.equal(await graph.tails.size(), 0)
        assert.equal(await graph.missing.size(), 0)
        assert.equal(await graph.denied.size(), 0)
      })

      it('overwrites a head node for an existing cid in a graph', async () => {
        const graph = new Graph({ blocks })
        await start(graph)

        const cid0 = nodes[0]
        const out0: CID[] = []

        const cid1 = nodes[1]
        const out1 = [cid0]

        await graph.add(cid0, out0)
        await graph.add(cid1, out1)
        await graph.miss(cid1)

        assert.equal(await graph.size(), 1)
        assert.equal(await graph.nodes.size(), 1)
        assert.deepEqual(
          await graph.get(cid0),
          muteNode()
        )

        assert.equal(await graph.heads.size(), 1)
        assert.equal(await graph.heads.has(cid0.toString()), true)

        assert.equal(await graph.tails.size(), 1)
        assert.equal(await graph.tails.has(cid0.toString()), true)

        assert.equal(await graph.missing.size(), 0)

        assert.equal(await graph.denied.size(), 0)
      })

      it('overwrites a tail node for an existing cid in a graph', async () => {
        const graph = new Graph({ blocks })
        await start(graph)

        const cid0 = nodes[0]
        const out0: CID[] = []

        const cid1 = nodes[1]
        const out1: CID[] = [cid0]

        await graph.add(cid0, out0)
        await graph.add(cid1, out1)
        await graph.miss(cid0)

        assert.equal(await graph.size(), 1)
        assert.equal(await graph.nodes.size(), 2)
        assert.deepEqual(
          await graph.get(cid0),
          missingNode({ in: new Set([cid1.toString()]) })
        )
        assert.deepEqual(
          await graph.get(cid1),
          muteNode({ out: new Set([cid0.toString()]) })
        )

        assert.equal(await graph.heads.size(), 1)
        assert.equal(await graph.heads.has(cid1.toString()), true)

        assert.equal(await graph.tails.size(), 1)
        assert.equal(await graph.tails.has(cid1.toString()), true)

        assert.equal(await graph.missing.size(), 1)
        assert.equal(await graph.missing.has(cid0.toString()), true)

        assert.equal(await graph.denied.size(), 0)
      })

      it('does not overwrite a node for a missing cid in a graph', async () => {
        const graph = new Graph({ blocks })
        await start(graph)

        const cid0 = nodes[0]
        const out0: CID[] = []

        const cid1 = nodes[1]
        const out1 = [cid0]

        await graph.add(cid0, out0)
        await graph.add(cid1, out1)
        await graph.miss(cid0)

        const node0 = await graph.get(cid0)

        await graph.miss(cid0)

        assert.equal(await graph.size(), 1)
        assert.equal(await graph.nodes.size(), 2)
        assert.deepEqual(await graph.get(cid0), node0)
        assert.deepEqual(
          await graph.get(cid1),
          muteNode({ out: new Set([cid0.toString()]) })
        )

        assert.equal(await graph.heads.size(), 1)
        assert.equal(await graph.heads.has(cid1.toString()), true)

        assert.equal(await graph.tails.size(), 1)
        assert.equal(await graph.tails.has(cid1.toString()), true)

        assert.equal(await graph.missing.size(), 1)
        assert.equal(await graph.missing.has(cid0.toString()), true)

        assert.equal(await graph.denied.size(), 0)
      })

      it('overwrites a node for a denied cid in a graph', async () => {
        const graph = new Graph({ blocks })
        await start(graph)

        const cid0 = nodes[0]
        const out0: CID[] = []

        const cid1 = nodes[1]
        const out1 = [cid0]

        await graph.add(cid0, out0)
        await graph.add(cid1, out1)
        await graph.deny(cid0)
        await graph.miss(cid0)

        assert.equal(await graph.size(), 1)
        assert.equal(await graph.nodes.size(), 2)
        assert.deepEqual(
          await graph.get(cid0),
          missingNode({ in: new Set([cid1.toString()]) })
        )
        assert.deepEqual(
          await graph.get(cid1),
          muteNode({ out: new Set([cid0.toString()]) })
        )

        assert.equal(await graph.heads.size(), 1)
        assert.equal(await graph.heads.has(cid1.toString()), true)

        assert.equal(await graph.tails.size(), 1)
        assert.equal(await graph.tails.has(cid1.toString()), true)

        assert.equal(await graph.missing.size(), 1)
        assert.equal(await graph.missing.has(cid0.toString()), true)

        assert.equal(await graph.denied.size(), 0)
      })

      it('prunes an orphaned missing node from the graph', async () => {
        const graph = new Graph({ blocks })
        await start(graph)

        const cid0 = nodes[0]
        const out0: CID[] = []

        const cid1 = nodes[1]
        const out1 = [cid0]

        const cid2 = nodes[2]
        const out2 = [cid1]

        await graph.add(cid0, out0)
        await graph.add(cid1, out1)
        await graph.add(cid2, out2)
        await graph.miss(cid0)
        await graph.miss(cid1)

        assert.equal(await graph.size(), 1)
        assert.equal(await graph.nodes.size(), 2)
        assert.deepEqual(
          await graph.get(cid1),
          missingNode({ in: new Set([cid2.toString()]) })
        )
        assert.deepEqual(
          await graph.get(cid2),
          muteNode({ out: new Set([cid1.toString()]) })
        )

        assert.equal(await graph.heads.size(), 1)
        assert.equal(await graph.heads.has(cid2.toString()), true)

        assert.equal(await graph.tails.size(), 1)
        assert.equal(await graph.tails.has(cid2.toString()), true)

        assert.equal(await graph.missing.size(), 1)
        assert.equal(await graph.missing.has(cid1.toString()), true)

        assert.equal(await graph.denied.size(), 0)
      })

      it('prunes an orphaned denied node from the graph', async () => {
        const graph = new Graph({ blocks })
        await start(graph)

        const cid0 = nodes[0]
        const out0: CID[] = []

        const cid1 = nodes[1]
        const out1 = [cid0]

        const cid2 = nodes[2]
        const out2 = [cid1]

        await graph.add(cid0, out0)
        await graph.add(cid1, out1)
        await graph.add(cid2, out2)
        await graph.deny(cid0)
        await graph.miss(cid1)

        assert.equal(await graph.size(), 1)
        assert.equal(await graph.nodes.size(), 2)
        assert.deepEqual(
          await graph.get(cid1),
          missingNode({ in: new Set([cid2.toString()]) })
        )
        assert.deepEqual(
          await graph.get(cid2),
          muteNode({ out: new Set([cid1.toString()]) })
        )

        assert.equal(await graph.heads.size(), 1)
        assert.equal(await graph.heads.has(cid2.toString()), true)

        assert.equal(await graph.tails.size(), 1)
        assert.equal(await graph.tails.has(cid2.toString()), true)

        assert.equal(await graph.missing.size(), 1)
        assert.equal(await graph.missing.has(cid1.toString()), true)

        assert.equal(await graph.denied.size(), 0)
      })
    })

    describe('deny', () => {
      it('does not add a denied cid to an empty graph', async () => {
        const graph = new Graph({ blocks })
        await start(graph)

        const cid0 = nodes[0]

        await graph.deny(cid0)

        assert.equal(await graph.size(), 0)
        assert.equal(await graph.heads.size(), 0)
        assert.equal(await graph.tails.size(), 0)
        assert.equal(await graph.missing.size(), 0)
        assert.equal(await graph.denied.size(), 0)
      })

      it('overwrites a head node for an existing cid in a graph', async () => {
        const graph = new Graph({ blocks })
        await start(graph)

        const cid0 = nodes[0]
        const out0: CID[] = []

        const cid1 = nodes[1]
        const out1 = [cid0]

        await graph.add(cid0, out0)
        await graph.add(cid1, out1)
        await graph.deny(cid1)

        assert.equal(await graph.size(), 1)
        assert.equal(await graph.nodes.size(), 1)
        assert.deepEqual(
          await graph.get(cid0),
          muteNode()
        )

        assert.equal(await graph.heads.size(), 1)
        assert.equal(await graph.heads.has(cid0.toString()), true)

        assert.equal(await graph.tails.size(), 1)
        assert.equal(await graph.tails.has(cid0.toString()), true)

        assert.equal(await graph.missing.size(), 0)

        assert.equal(await graph.denied.size(), 0)
      })

      it('overwrites a tail node for an existing cid in a graph', async () => {
        const graph = new Graph({ blocks })
        await start(graph)

        const cid0 = nodes[0]
        const out0: CID[] = []

        const cid1 = nodes[1]
        const out1 = [cid0]

        await graph.add(cid0, out0)
        await graph.add(cid1, out1)
        await graph.deny(cid0)

        assert.equal(await graph.size(), 1)
        assert.equal(await graph.nodes.size(), 2)
        assert.deepEqual(
          await graph.get(cid0),
          deniedNode({ in: new Set([cid1.toString()]) })
        )
        assert.deepEqual(
          await graph.get(cid1),
          muteNode({ out: new Set([cid0.toString()]) })
        )

        assert.equal(await graph.heads.size(), 1)
        assert.equal(await graph.heads.has(cid1.toString()), true)

        assert.equal(await graph.tails.size(), 1)
        assert.equal(await graph.tails.has(cid1.toString()), true)

        assert.equal(await graph.missing.size(), 0)

        assert.equal(await graph.denied.size(), 1)
        assert.equal(await graph.denied.has(cid0.toString()), true)
      })

      it('overwrites a node for a missing cid in a graph', async () => {
        const graph = new Graph({ blocks })
        await start(graph)

        const cid0 = nodes[0]
        const out0: CID[] = []

        const cid1 = nodes[1]
        const out1 = [cid0]

        await graph.add(cid0, out0)
        await graph.add(cid1, out1)
        await graph.miss(cid0)
        await graph.deny(cid0)

        assert.equal(await graph.size(), 1)
        assert.equal(await graph.nodes.size(), 2)
        assert.deepEqual(
          await graph.get(cid0),
          deniedNode({ in: new Set([cid1.toString()]) })
        )
        assert.deepEqual(
          await graph.get(cid1),
          muteNode({ out: new Set([cid0.toString()]) })
        )

        assert.equal(await graph.heads.size(), 1)
        assert.equal(await graph.heads.has(cid1.toString()), true)

        assert.equal(await graph.tails.size(), 1)
        assert.equal(await graph.tails.has(cid1.toString()), true)

        assert.equal(await graph.missing.size(), 0)

        assert.equal(await graph.denied.size(), 1)
        assert.equal(await graph.denied.has(cid0.toString()), true)
      })

      it('prunes an orphaned missing node from the graph', async () => {
        const graph = new Graph({ blocks })
        await start(graph)

        const cid0 = nodes[0]
        const out0: CID[] = []

        const cid1 = nodes[1]
        const out1 = [cid0]

        const cid2 = nodes[2]
        const out2 = [cid1]

        await graph.add(cid0, out0)
        await graph.add(cid1, out1)
        await graph.add(cid2, out2)
        await graph.miss(cid0)
        await graph.deny(cid1)

        assert.equal(await graph.size(), 1)
        assert.equal(await graph.nodes.size(), 2)
        assert.deepEqual(
          await graph.get(cid1),
          deniedNode({ in: new Set([cid2.toString()]) })
        )
        assert.deepEqual(
          await graph.get(cid2),
          muteNode({ out: new Set([cid1.toString()]) })
        )

        assert.equal(await graph.heads.size(), 1)
        assert.equal(await graph.heads.has(cid2.toString()), true)

        assert.equal(await graph.tails.size(), 1)
        assert.equal(await graph.tails.has(cid2.toString()), true)

        assert.equal(await graph.missing.size(), 0)

        assert.equal(await graph.denied.size(), 1)
        assert.equal(await graph.denied.has(cid1.toString()), true)
      })

      it('prunes an orphaned denied node from the graph', async () => {
        const graph = new Graph({ blocks })
        await start(graph)

        const cid0 = nodes[0]
        const out0: CID[] = []

        const cid1 = nodes[1]
        const out1 = [cid0]

        const cid2 = nodes[2]
        const out2 = [cid1]

        await graph.add(cid0, out0)
        await graph.add(cid1, out1)
        await graph.add(cid2, out2)
        await graph.deny(cid0)
        await graph.deny(cid1)

        assert.equal(await graph.size(), 1)
        assert.equal(await graph.nodes.size(), 2)
        assert.deepEqual(
          await graph.get(cid1),
          deniedNode({ in: new Set([cid2.toString()]) })
        )
        assert.deepEqual(
          await graph.get(cid2),
          muteNode({ out: new Set([cid1.toString()]) })
        )

        assert.equal(await graph.heads.size(), 1)
        assert.equal(await graph.heads.has(cid2.toString()), true)

        assert.equal(await graph.tails.size(), 1)
        assert.equal(await graph.tails.has(cid2.toString()), true)

        assert.equal(await graph.missing.size(), 0)

        assert.equal(await graph.denied.size(), 1)
        assert.equal(await graph.denied.has(cid1.toString()), true)
      })
    })

    describe('heads', () => {
      it('exposes graph heads', async () => {
        const graph = new Graph({ blocks })
        await start(graph)

        const cid0 = nodes[0]
        const out0: CID[] = []

        await graph.add(cid0, out0)

        assert.equal(await graph.heads.has(cid0.toString()), true)
        assert.equal(await graph.heads.size(), 1)

        const cid1 = nodes[1]
        const out1: CID[] = []

        await graph.add(cid1, out1)

        assert.equal(await graph.heads.has(cid0.toString()), true)
        assert.equal(await graph.heads.has(cid1.toString()), true)
        assert.equal(await graph.heads.size(), 2)

        const cid2 = nodes[2]
        const out2 = [cid0, cid1]

        await graph.add(cid2, out2)

        assert.equal(await graph.heads.has(cid2.toString()), true)
        assert.equal(await graph.heads.size(), 1)

        await graph.miss(cid0)

        assert.deepEqual(await graph.heads.has(cid2.toString()), true)
        assert.equal(await graph.heads.size(), 1)

        await graph.miss(cid1)

        assert.deepEqual(await graph.heads.has(cid2.toString()), true)
        assert.equal(await graph.heads.size(), 1)

        await graph.miss(cid2)

        assert.equal(await graph.heads.size(), 0)
      })
    })

    describe('tails', () => {
      it('exposes graph tails', async () => {
        const graph = new Graph({ blocks })
        await start(graph)

        const cid0 = nodes[0]
        const out0: CID[] = []

        await graph.add(cid0, out0)

        assert.equal(await graph.tails.size(), 1)
        assert.equal(await graph.tails.has(cid0.toString()), true)

        const cid1 = nodes[1]
        const out1: CID[] = []

        await graph.add(cid1, out1)

        assert.equal(await graph.tails.size(), 2)
        assert.equal(await graph.tails.has(cid0.toString()), true)
        assert.equal(await graph.tails.has(cid1.toString()), true)

        const cid2 = nodes[2]
        const out2 = [cid0, cid1]

        await graph.add(cid2, out2)

        assert.equal(await graph.tails.size(), 2)
        assert.equal(await graph.tails.has(cid0.toString()), true)
        assert.equal(await graph.tails.has(cid1.toString()), true)

        await graph.miss(cid0)

        assert.equal(await graph.tails.size(), 1)
        assert.equal(await graph.tails.has(cid1.toString()), true)

        await graph.miss(cid1)

        assert.equal(await graph.tails.size(), 1)
        assert.equal(await graph.tails.has(cid2.toString()), true)

        await graph.miss(cid2)

        assert.equal(await graph.tails.size(), 0)
      })
    })

    describe('missing', () => {
      it('exposes missing nodes', async () => {
        const graph = new Graph({ blocks })
        await start(graph)

        const cid0 = nodes[0]
        const cid1 = nodes[1]
        const out1 = [cid0]

        await graph.add(cid1, out1)

        assert.equal(await graph.missing.has(cid0.toString()), true)
        assert.equal(await graph.missing.size(), 1)
      })
    })

    describe('denied', () => {
      it('returns denied nodes of the graph as a Set of cids', async () => {
        const graph = new Graph({ blocks })
        await start(graph)

        const cid0 = nodes[0]
        const out0: CID[] = []
        const cid1 = nodes[1]
        const out1 = [cid0]

        await graph.add(cid0, out0)
        await graph.add(cid1, out1)
        await graph.deny(cid0)

        assert.equal(await graph.denied.has(cid0.toString()), true)
        assert.equal(await graph.denied.size(), 1)
      })
    })

    describe('known', () => {
      it('returns true if cid is known to graph', async () => {
        const graph = new Graph({ blocks })
        await start(graph)

        const cid0 = nodes[0]
        const cid1 = nodes[1]
        const out0 = [cid1]

        await graph.add(cid0, out0)

        assert.equal(await graph.known(cid0), true)
        assert.equal(await graph.known(cid1), true)
      })

      it('returns false if cid is unknown to graph', async () => {
        const graph = new Graph({ blocks })
        await start(graph)

        const cid0 = nodes[0]
        const cid1 = nodes[1]
        const cid3 = nodes[3]
        const out0 = [cid1]

        await graph.add(cid0, out0)

        assert.equal(await graph.known(cid3), false)
      })
    })

    describe('has', () => {
      it('returns true if cid is a vertex in the graph', async () => {
        const graph = new Graph({ blocks })
        await start(graph)

        const cid0 = nodes[0]
        const cid1 = nodes[1]
        const out0 = [cid1]

        await graph.add(cid0, out0)

        assert.equal(await graph.has(cid0), true)
      })

      it('returns false if cid is not a vertex in the graph', async () => {
        const graph = new Graph({ blocks })
        await start(graph)

        const cid0 = nodes[0]
        const cid1 = nodes[1]
        const out0 = [cid1]

        await graph.add(cid0, out0)

        assert.equal(await graph.has(cid1), false)
      })
    })

    describe('get', () => {
      it('returns a Node if cid is a vertex in the graph', async () => {
        const graph = new Graph({ blocks })
        await start(graph)

        const cid0 = nodes[0]
        const cid1 = nodes[1]
        const out0 = [cid1]

        await graph.add(cid0, out0)

        assert.deepEqual(
          await graph.get(cid0),
          muteNode({ out: new Set([cid1.toString()]) })
        )
        assert.deepEqual(
          await graph.get(cid1),
          missingNode({ in: new Set([cid0.toString()]) })
        )
      })

      it('returns undefined if cid is not a vertex in the graph', async () => {
        const graph = new Graph({ blocks })
        await start(graph)

        const cid0 = nodes[0]
        const cid1 = nodes[1]
        const cid2 = nodes[2]
        const out0 = [cid1]

        await graph.add(cid0, out0)

        assert.equal(await graph.get(cid2), undefined)
      })
    })

    describe('size', () => {
      it('returns the number of vertexes in the graph', async () => {
        const graph = new Graph({ blocks })
        await start(graph)

        const cid0 = nodes[0]
        const out0 = [nodes[1]]

        await graph.add(cid0, out0)

        assert.equal(await graph.size(), 1)
      })
    })
  })
})
