import { type ShardBlockView, ShardBlock } from '@alanshaw/pail/shard'
import { start } from '@libp2p/interfaces/startable'
import { assert } from 'aegir/chai'
import { LevelBlockstore } from 'blockstore-level'
import { Key } from 'interface-datastore'
import { getTestPaths, tempPath } from './utils/constants.js'
import type { CID } from 'multiformats/cid.js'
import { Node } from '@/replica/graph-node.js'
import { Graph } from '@/replica/graph.js'
import { encodeCbor } from '@/utils/block.js'
import { cidstring } from '@/utils/index.js'

const testName = 'graph'

describe(testName, () => {
  let
    blockstore: LevelBlockstore,
    emptyShard: ShardBlockView

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
    const testPaths = getTestPaths(tempPath, testName)
    blockstore = new LevelBlockstore(testPaths.replica + '/graph')
    await blockstore.open()

    emptyShard = await ShardBlock.create()
    // make 8 of each cid
    nodes = []
    missing = []
    denied = []
    for (let i = 0; i < 8; i++) {
      const { cid: node } = await encodeCbor({ node: true, i })
      const { cid: miss } = await encodeCbor({ miss: true, i })
      const { cid: deny } = await encodeCbor({ deny: true, i })
      nodes.push(node)
      missing.push(miss)
      denied.push(deny)
    }
  })

  describe('class', () => {
    describe('constructor', () => {
      it('returns instance', () => {
        const graph = new Graph(blockstore)
        assert.strictEqual(graph.blockstore, blockstore)
        assert.strictEqual(graph._root, null)
      })

      it('returns instance using provided root', () => {
        // const root = {}
        // const graph = new Graph({ blocks, root })
        // assert.strictEqual(graph.blocks, blocks)
        // assert.strictEqual(graph._root, root)
      })
    })
  })

  describe('instance', () => {
    it('exposes instance properties', async () => {
      const graph = new Graph(blockstore)

      assert.strictEqual(graph._root, null)
      assert.strictEqual(graph._state, null)
      assert.isOk(graph.known)
      assert.isOk(graph.get)
      assert.isOk(graph.has)
      assert.isOk(graph.add)
      assert.isOk(graph.miss)
      assert.isOk(graph.deny)

      await start(graph)

      assert.isOk(graph.state)
      assert.isOk(graph.root)
      assert.isOk(graph.nodes)
      assert.isOk(graph.heads)
      assert.isOk(graph.tails)
      assert.isOk(graph.missing)
      assert.isOk(graph.denied)
    })

    describe('add', () => {
      it('adds a cid to an empty graph', async () => {
        const graph = new Graph(blockstore)
        await start(graph)

        const cid = nodes[0]
        const out: CID[] = []

        await graph.add(cid, out)

        // assert.strictEqual(await graph.size(), 1)
        // assert.strictEqual(await graph.nodes.size(), 1)
        assert.deepEqual(await graph.get(cid), muteNode())

        // assert.strictEqual(await graph.heads.size(), 1)
        assert.strictEqual(await graph.heads.has(new Key(cidstring(cid))), true)

        // assert.strictEqual(await graph.tails.size(), 1)
        assert.strictEqual(await graph.tails.has(new Key(cidstring(cid))), true)

        assert.strictEqual(graph.root.missing.equals(emptyShard.cid), true)
        assert.strictEqual(graph.root.denied.equals(emptyShard.cid), true)
      })

      it('adds a cid to a graph and references an unknown node', async () => {
        const graph = new Graph(blockstore)
        await start(graph)

        const cid0 = nodes[0]
        const out0 = [missing[0]]

        await graph.add(cid0, out0)

        // assert.strictEqual(await graph.size(), 1)
        // assert.strictEqual(await graph.nodes.size(), 2)
        assert.deepEqual(
          await graph.get(cid0),
          muteNode({ out: new Set([missing[0].toString()]) })
        )
        assert.deepEqual(
          await graph.get(missing[0]),
          missingNode({ in: new Set([cid0.toString()]) })
        )

        // assert.strictEqual(await graph.heads.size(), 1)
        assert.strictEqual(await graph.heads.has(new Key(cidstring(cid0))), true)

        // assert.strictEqual(await graph.tails.size(), 1)
        assert.strictEqual(await graph.tails.has(new Key(cidstring(cid0))), true)

        // assert.strictEqual(await graph.missing.size(), 1)
        assert.strictEqual(await graph.missing.has(new Key(cidstring(missing[0]))), true)

        assert.strictEqual(graph.denied.root.equals(emptyShard.cid), true)
      })

      it('adds a cid to a graph and references an existing node', async () => {
        const graph = new Graph(blockstore)
        await start(graph)

        const cid0 = nodes[0]
        const out0: CID[] = []

        await graph.add(cid0, out0)

        const cid1 = nodes[1]
        const out1 = [cid0]

        await graph.add(cid1, out1)

        // assert.strictEqual(await graph.size(), 2)
        // assert.strictEqual(await graph.nodes.size(), 2)
        assert.deepEqual(
          await graph.get(cid0),
          muteNode({ in: new Set([cid1.toString()]) })
        )
        assert.deepEqual(
          await graph.get(cid1),
          muteNode({ out: new Set([cid0.toString()]) })
        )

        // assert.strictEqual(await graph.heads.size(), 1)
        assert.strictEqual(await graph.heads.has(new Key(cidstring(cid1))), true)

        // assert.strictEqual(await graph.tails.size(), 1)
        assert.strictEqual(await graph.tails.has(new Key(cidstring(cid0))), true)

        assert.strictEqual(graph.root.missing.equals(emptyShard.cid), true)
        assert.strictEqual(graph.root.denied.equals(emptyShard.cid), true)
      })

      it('adds a cid to a graph and references a missing node', async () => {
        const graph = new Graph(blockstore)
        await start(graph)

        const cid0 = nodes[0]
        const out0 = [missing[0]]

        await graph.add(cid0, out0)

        const cid1 = nodes[1]

        await graph.add(cid1, out0)

        // assert.strictEqual(await graph.size(), 2)
        // assert.strictEqual(await graph.nodes.size(), 3)
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

        // assert.strictEqual(await graph.heads.size(), 2)
        assert.strictEqual(await graph.heads.has(new Key(cidstring(cid1))), true)

        // assert.strictEqual(await graph.tails.size(), 2)
        assert.strictEqual(await graph.tails.has(new Key(cidstring(cid0))), true)

        // assert.strictEqual(await graph.missing.size(), 1)
        assert.strictEqual(await graph.missing.has(new Key(cidstring(missing[0]))), true)

        assert.strictEqual(graph.root.denied.equals(emptyShard.cid), true)
      })

      it('adds a cid to a graph and references a denied node', async () => {
        const graph = new Graph(blockstore)
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

        // assert.strictEqual(await graph.size(), 2)
        // assert.strictEqual(await graph.nodes.size(), 3)
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

        // assert.strictEqual(await graph.heads.size(), 2)
        assert.strictEqual(await graph.heads.has(new Key(cidstring(cid1))), true)
        assert.strictEqual(await graph.heads.has(new Key(cidstring(cid2))), true)

        // assert.strictEqual(await graph.tails.size(), 2)
        assert.strictEqual(await graph.tails.has(new Key(cidstring(cid1))), true)
        assert.strictEqual(await graph.tails.has(new Key(cidstring(cid2))), true)

        assert.strictEqual(graph.root.missing.equals(emptyShard.cid), true)

        // assert.strictEqual(await graph.denied.size(), 1)
        assert.strictEqual(await graph.denied.has(new Key(cidstring(cid0))), true)
      })

      it('does not overwrite an added node for an existing cid in a graph', async () => {
        const graph = new Graph(blockstore)
        await start(graph)

        const cid0 = nodes[0]
        const out0: CID[] = []

        await graph.add(cid0, out0)
        const node0 = await graph.get(cid0)

        const cid1 = nodes[0]
        const out1: CID[] = []

        await graph.add(cid1, out1)
        const node1 = await graph.get(cid1)

        // assert.strictEqual(await graph.size(), 1)
        // assert.strictEqual(await graph.nodes.size(), 1)
        assert.deepEqual(await graph.get(cid0), node1)
        assert.deepEqual(await graph.get(cid1), node0)

        // assert.strictEqual(await graph.heads.size(), 1)
        assert.strictEqual(await graph.heads.has(new Key(cidstring(cid0))), true)
        assert.strictEqual(await graph.heads.has(new Key(cidstring(cid1))), true)

        // assert.strictEqual(await graph.tails.size(), 1)
        assert.strictEqual(await graph.tails.has(new Key(cidstring(cid0))), true)
        assert.strictEqual(await graph.tails.has(new Key(cidstring(cid1))), true)

        assert.strictEqual(graph.root.missing.equals(emptyShard.cid), true)
        assert.strictEqual(graph.root.denied.equals(emptyShard.cid), true)
      })

      it('overwrites a node for a missing cid in a graph', async () => {
        const graph = new Graph(blockstore)
        await start(graph)

        const cid0 = nodes[0]
        const out0: CID[] = []

        const cid1 = nodes[1]
        const out1 = [cid0]

        await graph.add(cid1, out1)
        await graph.add(cid0, out0)

        // assert.strictEqual(await graph.size(), 2)
        // assert.strictEqual(await graph.nodes.size(), 2)
        assert.deepEqual(
          await graph.get(cid0),
          muteNode({ in: new Set([cid1.toString()]) })
        )
        assert.deepEqual(
          await graph.get(cid1),
          muteNode({ out: new Set([cid0.toString()]) })
        )

        // assert.strictEqual(await graph.heads.size(), 1)
        assert.strictEqual(await graph.heads.has(new Key(cidstring(cid1))), true)

        // assert.strictEqual(await graph.tails.size(), 1)
        assert.strictEqual(await graph.tails.has(new Key(cidstring(cid0))), true)

        assert.strictEqual(graph.root.missing.equals(emptyShard.cid), true)
        assert.strictEqual(graph.root.denied.equals(emptyShard.cid), true)
      })

      it('overwrites a node for a denied cid in a graph', async () => {
        const graph = new Graph(blockstore)
        await start(graph)

        const cid0 = nodes[0]
        const out0: CID[] = []

        const cid1 = nodes[1]
        const out1 = [cid0]

        await graph.add(cid0, out0)
        await graph.add(cid1, out1)
        await graph.deny(cid0)
        await graph.add(cid0, out0)

        // assert.strictEqual(await graph.size(), 2)
        // assert.strictEqual(await graph.nodes.size(), 2)
        assert.deepEqual(
          await graph.get(cid0),
          muteNode({ in: new Set([cid1.toString()]) })
        )
        assert.deepEqual(
          await graph.get(cid1),
          muteNode({ out: new Set([cid0.toString()]) })
        )

        // assert.strictEqual(await graph.heads.size(), 1)
        assert.strictEqual(await graph.heads.has(new Key(cidstring(cid1))), true)

        // assert.strictEqual(await graph.tails.size(), 1)
        assert.strictEqual(await graph.tails.has(new Key(cidstring(cid0))), true)

        assert.strictEqual(graph.root.missing.equals(emptyShard.cid), true)
        assert.strictEqual(graph.root.denied.equals(emptyShard.cid), true)
      })

      it('handles self-reference cids in out', async () => {
        const graph = new Graph(blockstore)
        await start(graph)

        const cid0 = nodes[0]
        const out0: CID[] = [cid0]

        await graph.add(cid0, out0)

        // assert.strictEqual(await graph.size(), 1)
        // assert.strictEqual(await graph.nodes.size(), 1)
        assert.deepEqual(await graph.get(cid0), muteNode())

        // assert.strictEqual(await graph.heads.size(), 1)
        assert.strictEqual(await graph.heads.has(new Key(cidstring(cid0))), true)

        // assert.strictEqual(await graph.tails.size(), 1)
        assert.strictEqual(await graph.tails.has(new Key(cidstring(cid0))), true)

        assert.strictEqual(graph.root.missing.equals(emptyShard.cid), true)
        assert.strictEqual(graph.root.denied.equals(emptyShard.cid), true)
      })
    })

    // miss and deny tests can be very similar as they both use await graph._rm

    describe('miss', () => {
      it('does not add a missing cid to an empty graph', async () => {
        const graph = new Graph(blockstore)
        await start(graph)

        const cid0 = missing[0]

        await graph.miss(cid0)

        assert.strictEqual(graph.root.nodes.equals(emptyShard.cid), true)
        assert.strictEqual(graph.root.heads.equals(emptyShard.cid), true)
        assert.strictEqual(graph.root.tails.equals(emptyShard.cid), true)
        assert.strictEqual(graph.root.missing.equals(emptyShard.cid), true)
        assert.strictEqual(graph.root.denied.equals(emptyShard.cid), true)
      })

      it('overwrites a head node for an existing cid in a graph', async () => {
        const graph = new Graph(blockstore)
        await start(graph)

        const cid0 = nodes[0]
        const out0: CID[] = []

        const cid1 = nodes[1]
        const out1 = [cid0]

        await graph.add(cid0, out0)
        await graph.add(cid1, out1)
        await graph.miss(cid1)

        // assert.strictEqual(await graph.nodes.size(), 1)
        assert.deepEqual(await graph.get(cid0), muteNode())

        // assert.strictEqual(await graph.heads.size(), 1)
        assert.strictEqual(await graph.heads.has(new Key(cidstring(cid0))), true)

        // assert.strictEqual(await graph.tails.size(), 1)
        assert.strictEqual(await graph.tails.has(new Key(cidstring(cid0))), true)

        assert.strictEqual(graph.root.missing.equals(emptyShard.cid), true)
        assert.strictEqual(graph.root.denied.equals(emptyShard.cid), true)
      })

      it('overwrites a tail node for an existing cid in a graph', async () => {
        const graph = new Graph(blockstore)
        await start(graph)

        const cid0 = nodes[0]
        const out0: CID[] = []

        const cid1 = nodes[1]
        const out1: CID[] = [cid0]

        await graph.add(cid0, out0)
        await graph.add(cid1, out1)
        await graph.miss(cid0)

        // assert.strictEqual(await graph.size(), 1)
        // assert.strictEqual(await graph.nodes.size(), 2)
        assert.deepEqual(
          await graph.get(cid0),
          missingNode({ in: new Set([cid1.toString()]) })
        )
        assert.deepEqual(
          await graph.get(cid1),
          muteNode({ out: new Set([cid0.toString()]) })
        )

        // assert.strictEqual(await graph.heads.size(), 1)
        assert.strictEqual(await graph.heads.has(new Key(cidstring(cid1))), true)

        // assert.strictEqual(await graph.tails.size(), 1)
        assert.strictEqual(await graph.tails.has(new Key(cidstring(cid1))), true)

        // assert.strictEqual(await graph.missing.size(), 1)
        assert.strictEqual(await graph.missing.has(new Key(cidstring(cid0))), true)

        assert.strictEqual(graph.root.denied.equals(emptyShard.cid), true)
      })

      it('does not overwrite a node for a missing cid in a graph', async () => {
        const graph = new Graph(blockstore)
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

        // assert.strictEqual(await graph.size(), 1)
        // assert.strictEqual(await graph.nodes.size(), 2)
        assert.deepEqual(await graph.get(cid0), node0)
        assert.deepEqual(
          await graph.get(cid1),
          muteNode({ out: new Set([cid0.toString()]) })
        )

        // assert.strictEqual(await graph.heads.size(), 1)
        assert.strictEqual(await graph.heads.has(new Key(cidstring(cid1))), true)

        // assert.strictEqual(await graph.tails.size(), 1)
        assert.strictEqual(await graph.tails.has(new Key(cidstring(cid1))), true)

        // assert.strictEqual(await graph.missing.size(), 1)
        assert.strictEqual(await graph.missing.has(new Key(cidstring(cid0))), true)

        assert.strictEqual(graph.root.denied.equals(emptyShard.cid), true)
      })

      it('overwrites a node for a denied cid in a graph', async () => {
        const graph = new Graph(blockstore)
        await start(graph)

        const cid0 = nodes[0]
        const out0: CID[] = []

        const cid1 = nodes[1]
        const out1 = [cid0]

        await graph.add(cid0, out0)
        await graph.add(cid1, out1)
        await graph.deny(cid0)
        await graph.miss(cid0)

        // assert.strictEqual(await graph.size(), 1)
        // assert.strictEqual(await graph.nodes.size(), 2)
        assert.deepEqual(
          await graph.get(cid0),
          missingNode({ in: new Set([cid1.toString()]) })
        )
        assert.deepEqual(
          await graph.get(cid1),
          muteNode({ out: new Set([cid0.toString()]) })
        )

        // assert.strictEqual(await graph.heads.size(), 1)
        assert.strictEqual(await graph.heads.has(new Key(cidstring(cid1))), true)

        // assert.strictEqual(await graph.tails.size(), 1)
        assert.strictEqual(await graph.tails.has(new Key(cidstring(cid1))), true)

        // assert.strictEqual(await graph.missing.size(), 1)
        assert.strictEqual(await graph.missing.has(new Key(cidstring(cid0))), true)

        assert.strictEqual(graph.root.denied.equals(emptyShard.cid), true)
      })

      it('prunes an orphaned missing node from the graph', async () => {
        const graph = new Graph(blockstore)
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

        // assert.strictEqual(await graph.size(), 1)
        // assert.strictEqual(await graph.nodes.size(), 2)
        assert.deepEqual(
          await graph.get(cid1),
          missingNode({ in: new Set([cid2.toString()]) })
        )
        assert.deepEqual(
          await graph.get(cid2),
          muteNode({ out: new Set([cid1.toString()]) })
        )

        // assert.strictEqual(await graph.heads.size(), 1)
        assert.strictEqual(await graph.heads.has(new Key(cidstring(cid2))), true)

        // assert.strictEqual(await graph.tails.size(), 1)
        assert.strictEqual(await graph.tails.has(new Key(cidstring(cid2))), true)

        // assert.strictEqual(await graph.missing.size(), 1)
        assert.strictEqual(await graph.missing.has(new Key(cidstring(cid1))), true)

        assert.strictEqual(graph.root.denied.equals(emptyShard.cid), true)
      })

      it('prunes an orphaned denied node from the graph', async () => {
        const graph = new Graph(blockstore)
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

        // assert.strictEqual(await graph.size(), 1)
        // assert.strictEqual(await graph.nodes.size(), 2)
        assert.deepEqual(
          await graph.get(cid1),
          missingNode({ in: new Set([cid2.toString()]) })
        )
        assert.deepEqual(
          await graph.get(cid2),
          muteNode({ out: new Set([cid1.toString()]) })
        )

        // assert.strictEqual(await graph.heads.size(), 1)
        assert.strictEqual(await graph.heads.has(new Key(cidstring(cid2))), true)

        // assert.strictEqual(await graph.tails.size(), 1)
        assert.strictEqual(await graph.tails.has(new Key(cidstring(cid2))), true)

        // assert.strictEqual(await graph.missing.size(), 1)
        assert.strictEqual(await graph.missing.has(new Key(cidstring(cid1))), true)

        assert.strictEqual(graph.root.denied.equals(emptyShard.cid), true)
      })
    })

    describe('deny', () => {
      it('does not add a denied cid to an empty graph', async () => {
        const graph = new Graph(blockstore)
        await start(graph)

        const cid0 = nodes[0]

        await graph.deny(cid0)

        assert.strictEqual(graph.root.nodes.equals(emptyShard.cid), true)
        assert.strictEqual(graph.root.heads.equals(emptyShard.cid), true)
        assert.strictEqual(graph.root.tails.equals(emptyShard.cid), true)
        assert.strictEqual(graph.root.missing.equals(emptyShard.cid), true)
        assert.strictEqual(graph.root.denied.equals(emptyShard.cid), true)
      })

      it('overwrites a head node for an existing cid in a graph', async () => {
        const graph = new Graph(blockstore)
        await start(graph)

        const cid0 = nodes[0]
        const out0: CID[] = []

        const cid1 = nodes[1]
        const out1 = [cid0]

        await graph.add(cid0, out0)
        await graph.add(cid1, out1)
        await graph.deny(cid1)

        // assert.strictEqual(await graph.size(), 1)
        // assert.strictEqual(await graph.nodes.size(), 1)
        assert.deepEqual(await graph.get(cid0), muteNode())

        // assert.strictEqual(await graph.heads.size(), 1)
        assert.strictEqual(await graph.heads.has(new Key(cidstring(cid0))), true)

        // assert.strictEqual(await graph.tails.size(), 1)
        assert.strictEqual(await graph.tails.has(new Key(cidstring(cid0))), true)

        assert.strictEqual(graph.root.missing.equals(emptyShard.cid), true)
        assert.strictEqual(graph.root.denied.equals(emptyShard.cid), true)
      })

      it('overwrites a tail node for an existing cid in a graph', async () => {
        const graph = new Graph(blockstore)
        await start(graph)

        const cid0 = nodes[0]
        const out0: CID[] = []

        const cid1 = nodes[1]
        const out1 = [cid0]

        await graph.add(cid0, out0)
        await graph.add(cid1, out1)
        await graph.deny(cid0)

        // assert.strictEqual(await graph.size(), 1)
        // assert.strictEqual(await graph.nodes.size(), 2)
        assert.deepEqual(
          await graph.get(cid0),
          deniedNode({ in: new Set([cid1.toString()]) })
        )
        assert.deepEqual(
          await graph.get(cid1),
          muteNode({ out: new Set([cid0.toString()]) })
        )

        // assert.strictEqual(await graph.heads.size(), 1)
        assert.strictEqual(await graph.heads.has(new Key(cidstring(cid1))), true)

        // assert.strictEqual(await graph.tails.size(), 1)
        assert.strictEqual(await graph.tails.has(new Key(cidstring(cid1))), true)

        assert.strictEqual(graph.root.missing.equals(emptyShard.cid), true)

        // assert.strictEqual(await graph.denied.size(), 1)
        assert.strictEqual(await graph.denied.has(new Key(cidstring(cid0))), true)
      })

      it('overwrites a node for a missing cid in a graph', async () => {
        const graph = new Graph(blockstore)
        await start(graph)

        const cid0 = nodes[0]
        const out0: CID[] = []

        const cid1 = nodes[1]
        const out1 = [cid0]

        await graph.add(cid0, out0)
        await graph.add(cid1, out1)
        await graph.miss(cid0)
        await graph.deny(cid0)

        // assert.strictEqual(await graph.size(), 1)
        // assert.strictEqual(await graph.nodes.size(), 2)
        assert.deepEqual(
          await graph.get(cid0),
          deniedNode({ in: new Set([cid1.toString()]) })
        )
        assert.deepEqual(
          await graph.get(cid1),
          muteNode({ out: new Set([cid0.toString()]) })
        )

        // assert.strictEqual(await graph.heads.size(), 1)
        assert.strictEqual(await graph.heads.has(new Key(cidstring(cid1))), true)

        // assert.strictEqual(await graph.tails.size(), 1)
        assert.strictEqual(await graph.tails.has(new Key(cidstring(cid1))), true)

        assert.strictEqual(graph.root.missing.equals(emptyShard.cid), true)

        // assert.strictEqual(await graph.denied.size(), 1)
        assert.strictEqual(await graph.denied.has(new Key(cidstring(cid0))), true)
      })

      it('prunes an orphaned missing node from the graph', async () => {
        const graph = new Graph(blockstore)
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

        // assert.strictEqual(await graph.size(), 1)
        // assert.strictEqual(await graph.nodes.size(), 2)
        assert.deepEqual(
          await graph.get(cid1),
          deniedNode({ in: new Set([cid2.toString()]) })
        )
        assert.deepEqual(
          await graph.get(cid2),
          muteNode({ out: new Set([cid1.toString()]) })
        )

        // assert.strictEqual(await graph.heads.size(), 1)
        assert.strictEqual(await graph.heads.has(new Key(cidstring(cid2))), true)

        // assert.strictEqual(await graph.tails.size(), 1)
        assert.strictEqual(await graph.tails.has(new Key(cidstring(cid2))), true)

        assert.strictEqual(graph.root.missing.equals(emptyShard.cid), true)

        // assert.strictEqual(await graph.denied.size(), 1)
        assert.strictEqual(await graph.denied.has(new Key(cidstring(cid1))), true)
      })

      it('prunes an orphaned denied node from the graph', async () => {
        const graph = new Graph(blockstore)
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

        // assert.strictEqual(await graph.size(), 1)
        // assert.strictEqual(await graph.nodes.size(), 2)
        assert.deepEqual(
          await graph.get(cid1),
          deniedNode({ in: new Set([cid2.toString()]) })
        )
        assert.deepEqual(
          await graph.get(cid2),
          muteNode({ out: new Set([cid1.toString()]) })
        )

        // assert.strictEqual(await graph.heads.size(), 1)
        assert.strictEqual(await graph.heads.has(new Key(cidstring(cid2))), true)

        // assert.strictEqual(await graph.tails.size(), 1)
        assert.strictEqual(await graph.tails.has(new Key(cidstring(cid2))), true)

        assert.strictEqual(graph.root.missing.equals(emptyShard.cid), true)

        // assert.strictEqual(await graph.denied.size(), 1)
        assert.strictEqual(await graph.denied.has(new Key(cidstring(cid1))), true)
      })
    })

    describe('heads', () => {
      it('exposes graph heads', async () => {
        const graph = new Graph(blockstore)
        await start(graph)

        const cid0 = nodes[0]
        const out0: CID[] = []

        await graph.add(cid0, out0)

        assert.strictEqual(await graph.heads.has(new Key(cidstring(cid0))), true)
        // assert.strictEqual(await graph.heads.size(), 1)

        const cid1 = nodes[1]
        const out1: CID[] = []

        await graph.add(cid1, out1)

        assert.strictEqual(await graph.heads.has(new Key(cidstring(cid0))), true)
        assert.strictEqual(await graph.heads.has(new Key(cidstring(cid1))), true)
        // assert.strictEqual(await graph.heads.size(), 2)

        const cid2 = nodes[2]
        const out2 = [cid0, cid1]

        await graph.add(cid2, out2)

        assert.strictEqual(await graph.heads.has(new Key(cidstring(cid2))), true)
        // assert.strictEqual(await graph.heads.size(), 1)

        await graph.miss(cid0)

        assert.deepEqual(await graph.heads.has(new Key(cidstring(cid2))), true)
        // assert.strictEqual(await graph.heads.size(), 1)

        await graph.miss(cid1)

        assert.deepEqual(await graph.heads.has(new Key(cidstring(cid2))), true)
        // assert.strictEqual(await graph.heads.size(), 1)

        await graph.miss(cid2)

        assert.strictEqual(graph.root.heads.equals(emptyShard.cid), true)
      })
    })

    describe('tails', () => {
      it('exposes graph tails', async () => {
        const graph = new Graph(blockstore)
        await start(graph)

        const cid0 = nodes[0]
        const out0: CID[] = []

        await graph.add(cid0, out0)

        // assert.strictEqual(await graph.tails.size(), 1)
        assert.strictEqual(await graph.tails.has(new Key(cidstring(cid0))), true)

        const cid1 = nodes[1]
        const out1: CID[] = []

        await graph.add(cid1, out1)

        // assert.strictEqual(await graph.tails.size(), 2)
        assert.strictEqual(await graph.tails.has(new Key(cidstring(cid0))), true)
        assert.strictEqual(await graph.tails.has(new Key(cidstring(cid1))), true)

        const cid2 = nodes[2]
        const out2 = [cid0, cid1]

        await graph.add(cid2, out2)

        // assert.strictEqual(await graph.tails.size(), 2)
        assert.strictEqual(await graph.tails.has(new Key(cidstring(cid0))), true)
        assert.strictEqual(await graph.tails.has(new Key(cidstring(cid1))), true)

        await graph.miss(cid0)

        // assert.strictEqual(await graph.tails.size(), 1)
        assert.strictEqual(await graph.tails.has(new Key(cidstring(cid1))), true)

        await graph.miss(cid1)

        // assert.strictEqual(await graph.tails.size(), 1)
        assert.strictEqual(await graph.tails.has(new Key(cidstring(cid2))), true)

        await graph.miss(cid2)

        assert.strictEqual(graph.root.tails.equals(emptyShard.cid), true)
      })
    })

    describe('missing', () => {
      it('exposes missing nodes', async () => {
        const graph = new Graph(blockstore)
        await start(graph)

        const cid0 = nodes[0]
        const cid1 = nodes[1]
        const out1 = [cid0]

        await graph.add(cid1, out1)

        assert.strictEqual(await graph.missing.has(new Key(cidstring(cid0))), true)
        // assert.strictEqual(await graph.missing.size(), 1)
      })
    })

    describe('denied', () => {
      it('returns denied nodes of the graph as a Set of cids', async () => {
        const graph = new Graph(blockstore)
        await start(graph)

        const cid0 = nodes[0]
        const out0: CID[] = []
        const cid1 = nodes[1]
        const out1 = [cid0]

        await graph.add(cid0, out0)
        await graph.add(cid1, out1)
        await graph.deny(cid0)

        assert.strictEqual(await graph.denied.has(new Key(cidstring(cid0))), true)
        // assert.strictEqual(await graph.denied.size(), 1)
      })
    })

    describe('known', () => {
      it('returns true if cid is known to graph', async () => {
        const graph = new Graph(blockstore)
        await start(graph)

        const cid0 = nodes[0]
        const cid1 = nodes[1]
        const out0 = [cid1]

        await graph.add(cid0, out0)

        assert.strictEqual(await graph.known(cid0), true)
        assert.strictEqual(await graph.known(cid1), true)
      })

      it('returns false if cid is unknown to graph', async () => {
        const graph = new Graph(blockstore)
        await start(graph)

        const cid0 = nodes[0]
        const cid1 = nodes[1]
        const cid3 = nodes[3]
        const out0 = [cid1]

        await graph.add(cid0, out0)

        assert.strictEqual(await graph.known(cid3), false)
      })
    })

    describe('has', () => {
      it('returns true if cid is a vertex in the graph', async () => {
        const graph = new Graph(blockstore)
        await start(graph)

        const cid0 = nodes[0]
        const cid1 = nodes[1]
        const out0 = [cid1]

        await graph.add(cid0, out0)

        assert.strictEqual(await graph.has(cid0), true)
      })

      it('returns false if cid is not a vertex in the graph', async () => {
        const graph = new Graph(blockstore)
        await start(graph)

        const cid0 = nodes[0]
        const cid1 = nodes[1]
        const out0 = [cid1]

        await graph.add(cid0, out0)

        assert.strictEqual(await graph.has(cid1), false)
      })
    })

    describe('get', () => {
      it('returns a Node if cid is a vertex in the graph', async () => {
        const graph = new Graph(blockstore)
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
        const graph = new Graph(blockstore)
        await start(graph)

        const cid0 = nodes[0]
        const cid1 = nodes[1]
        const cid2 = nodes[2]
        const out0 = [cid1]

        await graph.add(cid0, out0)

        assert.strictEqual(await graph.get(cid2), undefined)
      })
    })
  })
})
