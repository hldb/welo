import { strict as assert } from 'assert'
import { CID } from 'multiformats/cid.js'

import { Graph, GraphObj, Node } from '../src/database/graph.js'
import { Blocks } from '../src/mods/blocks.js'

describe('Graph', () => {
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
  const missNode = ({ in: ni }: { in: Set<string> }): Node =>
    new Node({ ...muteNode({ in: ni }), miss: true })
  const denyNode = ({ in: ni }: { in: Set<string> }): Node =>
    new Node({ ...muteNode({ in: ni }), deny: true })

  const initialGraph: GraphObj = {
    nodes: new Map(),
    // heads: new Set(),
    // tails: new Set(),
    missing: new Set(),
    denied: new Set()
  }
  const newGraph = new Graph(initialGraph)

  before(async () => {
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

  describe('class', () => {
    it('exposes static properties', () => {
      assert.ok(Graph.init)
      assert.ok(Graph.clone)
      assert.ok(Graph.add)
      assert.ok(Graph.miss)
      assert.ok(Graph.deny)
    })

    describe('.init', () => {
      it('returns an empty graph state', () => {
        const graph = Graph.init()
        assert.deepEqual(graph, newGraph)
      })
    })

    describe('.clone', () => {
      it('returns a clone of a new graph', () => {
        const graph = Graph.init()

        const clone = Graph.clone(graph)

        assert.notEqual(clone, graph)
        assert.deepEqual(clone, graph)
      })

      it('returns a clone of a mutated graph', () => {
        const graph = Graph.init()
        const cid = nodes[0]
        const out = [nodes[1], missing[0], denied[0]]
        Graph.add(graph, cid, out)

        const clone = Graph.clone(graph)

        assert.notEqual(clone, graph)
        assert.deepEqual(clone, graph)
      })
    })

    describe('add', () => {
      it('adds a cid to an empty graph', () => {
        const graph = Graph.init()
        const cid = nodes[0]
        const out: CID[] = []

        Graph.add(graph, cid, out)

        assert.equal(graph.size, 1)
        assert.equal(graph.nodes.size, 1)
        assert.deepEqual(graph.nodes.get(cid.toString()), muteNode())

        assert.equal(graph.heads.size, 1)
        assert.equal(graph.heads.has(cid.toString()), true)

        assert.equal(graph.tails.size, 1)
        assert.equal(graph.tails.has(cid.toString()), true)

        assert.equal(graph.missing.size, 0)
        assert.equal(graph.denied.size, 0)
      })

      it('adds a cid to a graph and references an unknown node', () => {
        const graph = Graph.init()
        const cid0 = nodes[0]
        const out0 = [missing[0]]

        Graph.add(graph, cid0, out0)

        assert.equal(graph.size, 1)
        assert.equal(graph.nodes.size, 2)
        assert.deepEqual(
          graph.nodes.get(cid0.toString()),
          muteNode({ out: new Set([missing[0].toString()]) })
        )
        assert.deepEqual(
          graph.nodes.get(missing[0].toString()),
          missNode({ in: new Set([cid0.toString()]) })
        )

        assert.equal(graph.heads.size, 1)
        assert.equal(graph.heads.has(cid0.toString()), true)

        assert.equal(graph.tails.size, 1)
        assert.equal(graph.tails.has(cid0.toString()), true)

        assert.equal(graph.missing.size, 1)
        assert.equal(graph.missing.has(missing[0].toString()), true)

        assert.equal(graph.denied.size, 0)
      })

      it('adds a cid to a graph and references an exising node', () => {
        const graph = Graph.init()
        const cid0 = nodes[0]
        const out0: CID[] = []

        Graph.add(graph, cid0, out0)

        const cid1 = nodes[1]
        const out1 = [cid0]

        Graph.add(graph, cid1, out1)

        assert.equal(graph.size, 2)
        assert.equal(graph.nodes.size, 2)
        assert.deepEqual(
          graph.nodes.get(cid0.toString()),
          muteNode({ in: new Set([cid1.toString()]) })
        )
        assert.deepEqual(
          graph.nodes.get(cid1.toString()),
          muteNode({ out: new Set([cid0.toString()]) })
        )

        assert.equal(graph.heads.size, 1)
        assert.equal(graph.heads.has(cid1.toString()), true)

        assert.equal(graph.tails.size, 1)
        assert.equal(graph.tails.has(cid0.toString()), true)

        assert.equal(graph.missing.size, 0)
        assert.equal(graph.denied.size, 0)
      })

      it('adds a cid to a graph and references a missing node', () => {
        const graph = Graph.init()
        const cid0 = nodes[0]
        const out0 = [missing[0]]

        Graph.add(graph, cid0, out0)

        const cid1 = nodes[1]
        const out1 = [missing[0]]

        Graph.add(graph, cid1, out1)

        assert.equal(graph.size, 2)
        assert.equal(graph.nodes.size, 3)
        assert.deepEqual(
          graph.nodes.get(cid0.toString()),
          muteNode({ out: new Set([missing[0].toString()]) })
        )
        assert.deepEqual(
          graph.nodes.get(cid1.toString()),
          muteNode({ out: new Set([missing[0].toString()]) })
        )
        assert.deepEqual(
          graph.nodes.get(missing[0].toString()),
          missNode({ in: new Set([cid0.toString(), cid1.toString()]) })
        )

        assert.equal(graph.heads.size, 2)
        assert.equal(graph.heads.has(cid1.toString()), true)

        assert.equal(graph.tails.size, 2)
        assert.equal(graph.tails.has(cid0.toString()), true)

        assert.equal(graph.missing.size, 1)
        assert.equal(graph.missing.has(missing[0].toString()), true)

        assert.equal(graph.denied.size, 0)
      })

      it('adds a cid to a graph and references a denied node', () => {
        const graph = Graph.init()
        const cid0 = denied[0]
        const out0: CID[] = []

        Graph.add(graph, cid0, out0)

        const cid1 = nodes[1]
        const out1 = [cid0]

        Graph.add(graph, cid1, out1)
        Graph.deny(graph, cid0)

        const cid2 = nodes[2]
        const out2 = [cid0]

        Graph.add(graph, cid2, out2)

        assert.equal(graph.size, 2)
        assert.equal(graph.nodes.size, 3)
        assert.deepEqual(
          graph.nodes.get(cid0.toString()),
          denyNode({ in: new Set([cid1.toString(), cid2.toString()]) })
        )
        assert.deepEqual(
          graph.nodes.get(cid1.toString()),
          muteNode({ out: new Set([cid0.toString()]) })
        )
        assert.deepEqual(
          graph.nodes.get(cid2.toString()),
          muteNode({ out: new Set([cid0.toString()]) })
        )

        assert.equal(graph.heads.size, 2)
        assert.equal(graph.heads.has(cid1.toString()), true)
        assert.equal(graph.heads.has(cid2.toString()), true)

        assert.equal(graph.tails.size, 2)
        assert.equal(graph.tails.has(cid1.toString()), true)
        assert.equal(graph.tails.has(cid2.toString()), true)

        assert.equal(graph.missing.size, 0)

        assert.equal(graph.denied.size, 1)
        assert.equal(graph.denied.has(cid0.toString()), true)
      })

      it('does not overwrite an added node for an existing cid in a graph', () => {
        const graph = Graph.init()
        const cid0 = nodes[0]
        const out0: CID[] = []

        Graph.add(graph, cid0, out0)
        const node0 = graph.get(cid0)

        const cid1 = nodes[0]
        const out1: CID[] = []

        Graph.add(graph, cid1, out1)
        const node1 = graph.get(cid1)

        assert.equal(graph.size, 1)
        assert.equal(graph.nodes.size, 1)
        assert.equal(graph.nodes.get(cid0.toString()), node1)
        assert.equal(graph.nodes.get(cid1.toString()), node0)

        assert.equal(graph.heads.size, 1)
        assert.equal(graph.heads.has(cid0.toString()), true)
        assert.equal(graph.heads.has(cid1.toString()), true)

        assert.equal(graph.tails.size, 1)
        assert.equal(graph.tails.has(cid0.toString()), true)
        assert.equal(graph.tails.has(cid1.toString()), true)

        assert.equal(graph.missing.size, 0)

        assert.equal(graph.denied.size, 0)
      })

      it('overwrites a node for a missing cid in a graph', () => {
        const graph = Graph.init()
        const cid0 = nodes[0]
        const out0: CID[] = []

        const cid1 = nodes[1]
        const out1 = [cid0]

        Graph.add(graph, cid1, out1)
        Graph.add(graph, cid0, out0)

        assert.equal(graph.size, 2)
        assert.equal(graph.nodes.size, 2)
        assert.deepEqual(
          graph.nodes.get(cid0.toString()),
          muteNode({ in: new Set([cid1.toString()]) })
        )
        assert.deepEqual(
          graph.nodes.get(cid1.toString()),
          muteNode({ out: new Set([cid0.toString()]) })
        )

        assert.equal(graph.heads.size, 1)
        assert.equal(graph.heads.has(cid1.toString()), true)

        assert.equal(graph.tails.size, 1)
        assert.equal(graph.tails.has(cid0.toString()), true)

        assert.equal(graph.missing.size, 0)

        assert.equal(graph.denied.size, 0)
      })

      it('overwrites a node for a denied cid in a graph', () => {
        const graph = Graph.init()
        const cid0 = nodes[0]
        const out0: CID[] = []

        const cid1 = nodes[1]
        const out1 = [cid0]

        Graph.add(graph, cid0, out0)
        Graph.add(graph, cid1, out1)
        Graph.deny(graph, cid0)
        Graph.add(graph, cid0, out0)

        assert.equal(graph.size, 2)
        assert.equal(graph.nodes.size, 2)
        assert.deepEqual(
          graph.nodes.get(cid0.toString()),
          muteNode({ in: new Set([cid1.toString()]) })
        )
        assert.deepEqual(
          graph.nodes.get(cid1.toString()),
          muteNode({ out: new Set([cid0.toString()]) })
        )

        assert.equal(graph.heads.size, 1)
        assert.equal(graph.heads.has(cid1.toString()), true)

        assert.equal(graph.tails.size, 1)
        assert.equal(graph.tails.has(cid0.toString()), true)

        assert.equal(graph.missing.size, 0)

        assert.equal(graph.denied.size, 0)
      })
    })

    // miss and deny tests can be very similar as they both use Graph._rm

    describe('miss', () => {
      it('does not add a missing cid to an empty graph', () => {
        const graph = Graph.init()
        const cid0 = missing[0]

        Graph.miss(graph, cid0)

        assert.deepEqual(graph, newGraph)
      })

      it('overwrites a node for an existing cid in a graph', () => {
        const graph = Graph.init()
        const cid0 = nodes[0]
        const out0: CID[] = []

        const cid1 = nodes[1]
        const out1: CID[] = [cid0]

        Graph.add(graph, cid0, out0)
        Graph.add(graph, cid1, out1)
        Graph.miss(graph, cid0)

        assert.equal(graph.size, 1)
        assert.equal(graph.nodes.size, 2)
        assert.deepEqual(
          graph.nodes.get(cid0.toString()),
          missNode({ in: new Set([cid1.toString()]) })
        )
        assert.deepEqual(
          graph.nodes.get(cid1.toString()),
          muteNode({ out: new Set([cid0.toString()]) })
        )

        assert.equal(graph.heads.size, 1)
        assert.equal(graph.heads.has(cid1.toString()), true)

        assert.equal(graph.tails.size, 1)
        assert.equal(graph.tails.has(cid1.toString()), true)

        assert.equal(graph.missing.size, 1)
        assert.equal(graph.missing.has(cid0.toString()), true)

        assert.equal(graph.denied.size, 0)
      })

      it('does not overwrite a node for a missing cid in a graph', () => {
        const graph = Graph.init()
        const cid0 = nodes[0]
        const out0: CID[] = []

        const cid1 = nodes[1]
        const out1 = [cid0]

        Graph.add(graph, cid0, out0)
        Graph.add(graph, cid1, out1)
        Graph.miss(graph, cid0)

        const node0 = graph.nodes.get(cid0.toString())

        Graph.miss(graph, cid0)

        assert.equal(graph.size, 1)
        assert.equal(graph.nodes.size, 2)
        assert.equal(graph.nodes.get(cid0.toString()), node0)
        assert.deepEqual(
          graph.nodes.get(cid1.toString()),
          muteNode({ out: new Set([cid0.toString()]) })
        )

        assert.equal(graph.heads.size, 1)
        assert.equal(graph.heads.has(cid1.toString()), true)

        assert.equal(graph.tails.size, 1)
        assert.equal(graph.tails.has(cid1.toString()), true)

        assert.equal(graph.missing.size, 1)
        assert.equal(graph.missing.has(cid0.toString()), true)

        assert.equal(graph.denied.size, 0)
      })

      it('overwrites a node for a denied cid in a graph', () => {
        const graph = Graph.init()
        const cid0 = nodes[0]
        const out0: CID[] = []

        const cid1 = nodes[1]
        const out1 = [cid0]

        Graph.add(graph, cid0, out0)
        Graph.add(graph, cid1, out1)
        Graph.deny(graph, cid0)
        Graph.miss(graph, cid0)

        assert.equal(graph.size, 1)
        assert.equal(graph.nodes.size, 2)
        assert.deepEqual(
          graph.nodes.get(cid0.toString()),
          missNode({ in: new Set([cid1.toString()]) })
        )
        assert.deepEqual(
          graph.nodes.get(cid1.toString()),
          muteNode({ out: new Set([cid0.toString()]) })
        )

        assert.equal(graph.heads.size, 1)
        assert.equal(graph.heads.has(cid1.toString()), true)

        assert.equal(graph.tails.size, 1)
        assert.equal(graph.tails.has(cid1.toString()), true)

        assert.equal(graph.missing.size, 1)
        assert.equal(graph.missing.has(cid0.toString()), true)

        assert.equal(graph.denied.size, 0)
      })

      it('removes an orphaned node for an existing cid in a graph', () => {
        const graph = Graph.init()
        const cid0 = nodes[0]
        const out0: CID[] = []

        const cid1 = nodes[1]
        const out1 = [cid0]

        const cid2 = nodes[2]
        const out2 = [cid1]

        Graph.add(graph, cid0, out0)
        Graph.add(graph, cid1, out1)
        Graph.add(graph, cid2, out2)
        Graph.miss(graph, cid1)

        assert.equal(graph.size, 1)
        assert.equal(graph.nodes.size, 2)
        assert.deepEqual(
          graph.nodes.get(cid1.toString()),
          missNode({ in: new Set([cid2.toString()]) })
        )
        assert.deepEqual(
          graph.nodes.get(cid2.toString()),
          muteNode({ out: new Set([cid1.toString()]) })
        )

        assert.equal(graph.heads.size, 1)
        assert.equal(graph.heads.has(cid2.toString()), true)

        assert.equal(graph.tails.size, 1)
        assert.equal(graph.tails.has(cid2.toString()), true)

        assert.equal(graph.missing.size, 1)
        assert.equal(graph.missing.has(cid1.toString()), true)

        assert.equal(graph.denied.size, 0)
      })

      it('removes multiple orphaned nodes for an existing cid in a graph', () => {
        const graph = Graph.init()
        const cid0 = nodes[0]
        const out0: CID[] = []

        const cid1 = nodes[1]
        const out1 = [cid0]

        const cid2 = nodes[2]
        const out2 = [cid1]

        const cid3 = nodes[3]
        const out3 = [cid2]

        Graph.add(graph, cid0, out0)
        Graph.add(graph, cid1, out1)
        Graph.add(graph, cid2, out2)
        Graph.add(graph, cid3, out3)
        Graph.miss(graph, cid3)

        assert.deepEqual(graph, newGraph)
      })
    })

    describe('deny', () => {
      it('does not add a denied cid to an empty graph', () => {
        const graph = Graph.init()
        const cid0 = nodes[0]

        Graph.miss(graph, cid0)

        assert.deepEqual(graph, newGraph)
      })

      it('overwrites a node for an existing cid in a graph', () => {
        const graph = Graph.init()
        const cid0 = nodes[0]
        const out0: CID[] = []

        const cid1 = nodes[1]
        const out1 = [cid0]

        Graph.add(graph, cid0, out0)
        Graph.add(graph, cid1, out1)
        Graph.deny(graph, cid0)

        assert.equal(graph.size, 1)
        assert.equal(graph.nodes.size, 2)
        assert.deepEqual(
          graph.nodes.get(cid0.toString()),
          denyNode({ in: new Set([cid1.toString()]) })
        )
        assert.deepEqual(
          graph.nodes.get(cid1.toString()),
          muteNode({ out: new Set([cid0.toString()]) })
        )

        assert.equal(graph.heads.size, 1)
        assert.equal(graph.heads.has(cid1.toString()), true)

        assert.equal(graph.tails.size, 1)
        assert.equal(graph.tails.has(cid1.toString()), true)

        assert.equal(graph.missing.size, 0)

        assert.equal(graph.denied.size, 1)
        assert.equal(graph.denied.has(cid0.toString()), true)
      })

      it('overwrites a node for a missing cid in a graph', () => {
        const graph = Graph.init()
        const cid0 = nodes[0]
        const out0: CID[] = []

        const cid1 = nodes[1]
        const out1 = [cid0]

        Graph.add(graph, cid0, out0)
        Graph.add(graph, cid1, out1)
        Graph.miss(graph, cid0)
        Graph.deny(graph, cid0)

        assert.equal(graph.size, 1)
        assert.equal(graph.nodes.size, 2)
        assert.deepEqual(
          graph.nodes.get(cid0.toString()),
          denyNode({ in: new Set([cid1.toString()]) })
        )
        assert.deepEqual(
          graph.nodes.get(cid1.toString()),
          muteNode({ out: new Set([cid0.toString()]) })
        )

        assert.equal(graph.heads.size, 1)
        assert.equal(graph.heads.has(cid1.toString()), true)

        assert.equal(graph.tails.size, 1)
        assert.equal(graph.tails.has(cid1.toString()), true)

        assert.equal(graph.missing.size, 0)

        assert.equal(graph.denied.size, 1)
        assert.equal(graph.denied.has(cid0.toString()), true)
      })

      it('does not overwrite a node for a denied cid in a graph', () => {
        const graph = Graph.init()
        const cid0 = nodes[0]
        const out0: CID[] = []

        const cid1 = nodes[1]
        const out1 = [cid0]

        Graph.add(graph, cid0, out0)
        Graph.add(graph, cid1, out1)
        Graph.deny(graph, cid0)

        const node0 = graph.nodes.get(cid0.toString())

        Graph.deny(graph, cid0)

        assert.equal(graph.size, 1)
        assert.equal(graph.nodes.size, 2)
        assert.equal(graph.nodes.get(cid0.toString()), node0)
        assert.deepEqual(
          graph.nodes.get(cid1.toString()),
          muteNode({ out: new Set([cid0.toString()]) })
        )

        assert.equal(graph.heads.size, 1)
        assert.equal(graph.heads.has(cid1.toString()), true)

        assert.equal(graph.tails.size, 1)
        assert.equal(graph.tails.has(cid1.toString()), true)

        assert.equal(graph.missing.size, 0)

        assert.equal(graph.denied.size, 1)
        assert.equal(graph.denied.has(cid0.toString()), true)
      })

      it('removes an orphaned node for an existing cid in a graph', () => {
        const graph = Graph.init()
        const cid0 = nodes[0]
        const out0: CID[] = []

        const cid1 = nodes[1]
        const out1 = [cid0]

        const cid2 = nodes[2]
        const out2 = [cid1]

        Graph.add(graph, cid0, out0)
        Graph.add(graph, cid1, out1)
        Graph.add(graph, cid2, out2)
        Graph.deny(graph, cid1)

        assert.equal(graph.size, 1)
        assert.equal(graph.nodes.size, 2)
        assert.deepEqual(
          graph.nodes.get(cid1.toString()),
          denyNode({ in: new Set([cid2.toString()]) })
        )
        assert.deepEqual(
          graph.nodes.get(cid2.toString()),
          muteNode({ out: new Set([cid1.toString()]) })
        )

        assert.equal(graph.heads.size, 1)
        assert.equal(graph.heads.has(cid2.toString()), true)

        assert.equal(graph.tails.size, 1)
        assert.equal(graph.tails.has(cid2.toString()), true)

        assert.equal(graph.missing.size, 0)

        assert.equal(graph.denied.size, 1)
        assert.equal(graph.denied.has(cid1.toString()), true)
      })

      it('removes multiple orphaned nodes for an existing cid in a graph', () => {
        const graph = Graph.init()
        const cid0 = nodes[0]
        const out0: CID[] = []

        const cid1 = nodes[1]
        const out1 = [cid0]

        const cid2 = nodes[2]
        const out2 = [cid1]

        const cid3 = nodes[3]
        const out3 = [cid2]

        Graph.add(graph, cid0, out0)
        Graph.add(graph, cid1, out1)
        Graph.add(graph, cid2, out2)
        Graph.add(graph, cid3, out3)
        Graph.deny(graph, cid3)

        assert.deepEqual(graph, newGraph)
      })
    })
  })

  describe('instance', () => {
    it('exposes instance properties', () => {
      const graph = new Graph()
      assert.deepEqual(graph, newGraph)

      assert.ok(graph.nodes instanceof Map)
      assert.ok(graph.heads instanceof Set)
      assert.ok(graph.tails instanceof Set)
      assert.ok(graph.missing instanceof Set)
      assert.ok(graph.denied instanceof Set)
      assert.ok(graph.known)
      assert.ok(graph.has)
      assert.ok(graph.get)
      assert.ok(graph.size === 0)
    })

    // heads and tails test need to be improved when they are made stateful

    describe('heads', () => {
      it('returns the heads of the graph as a Set of cids', () => {
        const graph = Graph.init()
        const cid0 = nodes[0]
        const out0: CID[] = []

        Graph.add(graph, cid0, out0)

        assert.deepEqual(graph.heads, new Set([cid0.toString()]))

        const cid1 = nodes[1]
        const out1: CID[] = []

        Graph.add(graph, cid1, out1)

        assert.deepEqual(
          graph.heads,
          new Set([cid0.toString(), cid1.toString()])
        )

        const cid2 = nodes[2]
        const out2 = [cid0, cid1]

        Graph.add(graph, cid2, out2)

        assert.deepEqual(graph.heads, new Set([cid2.toString()]))

        Graph.miss(graph, cid0)

        assert.deepEqual(graph.heads, new Set([cid2.toString()]))

        Graph.miss(graph, cid1)

        assert.deepEqual(graph.heads, new Set([cid2.toString()]))

        Graph.miss(graph, cid2)

        assert.deepEqual(graph.heads, new Set())
      })
    })

    describe('tails', () => {
      it('returns the tails of the graph as a Set of cids', () => {
        const graph = Graph.init()
        const cid0 = nodes[0]
        const out0: CID[] = []

        Graph.add(graph, cid0, out0)

        assert.deepEqual(graph.tails, new Set([cid0.toString()]))

        const cid1 = nodes[1]
        const out1: CID[] = []

        Graph.add(graph, cid1, out1)

        assert.deepEqual(
          graph.tails,
          new Set([cid0.toString(), cid1.toString()])
        )

        const cid2 = nodes[2]
        const out2 = [cid0, cid1]

        Graph.add(graph, cid2, out2)

        assert.deepEqual(
          graph.tails,
          new Set([cid0.toString(), cid1.toString()])
        )

        Graph.miss(graph, cid0)

        assert.deepEqual(graph.tails, new Set([cid1.toString()]))

        Graph.miss(graph, cid1)

        assert.deepEqual(graph.tails, new Set([cid2.toString()]))

        Graph.miss(graph, cid2)

        assert.deepEqual(graph.tails, new Set())
      })
    })

    describe('missing', () => {
      it('returns missing nodes of the graph as a Set of cids', () => {
        const graph = Graph.init()
        const cid0 = nodes[0]
        const cid1 = nodes[1]
        const out1 = [cid0]

        Graph.add(graph, cid1, out1)

        assert.deepEqual(graph.missing, new Set([cid0.toString()]))
      })
    })

    describe('denied', () => {
      it('returns denied nodes of the graph as a Set of cids', () => {
        const graph = Graph.init()
        const cid0 = nodes[0]
        const out0: CID[] = []
        const cid1 = nodes[1]
        const out1 = [cid0]

        Graph.add(graph, cid0, out0)
        Graph.add(graph, cid1, out1)
        Graph.deny(graph, cid0)

        assert.deepEqual(graph.denied, new Set([cid0.toString()]))
      })
    })

    describe('known', () => {
      it('returns true if cid is known to graph', () => {
        const graph = Graph.init()
        const cid0 = nodes[0]
        const cid1 = nodes[1]
        const out0 = [cid1]

        Graph.add(graph, cid0, out0)

        assert.equal(graph.known(cid0), true)
        assert.equal(graph.known(cid1), true)
      })

      it('returns false if cid is unknown to graph', () => {
        const graph = Graph.init()
        const cid0 = nodes[0]
        const cid1 = nodes[1]
        const cid3 = nodes[3]
        const out0 = [cid1]

        Graph.add(graph, cid0, out0)

        assert.equal(graph.known(cid3), false)
      })
    })

    describe('has', () => {
      it('returns true if cid is a vertex in the graph', () => {
        const graph = Graph.init()
        const cid0 = nodes[0]
        const cid1 = nodes[1]
        const out0 = [cid1]

        Graph.add(graph, cid0, out0)

        assert.equal(graph.has(cid0), true)
      })

      it('returns false if cid is not a vertex in the graph', () => {
        const graph = Graph.init()
        const cid0 = nodes[0]
        const cid1 = nodes[1]
        const out0 = [cid1]

        Graph.add(graph, cid0, out0)

        assert.equal(graph.has(cid1), false)
      })
    })

    describe('get', () => {
      it('returns a Node if cid is a vertex in the graph', () => {
        const graph = Graph.init()
        const cid0 = nodes[0]
        const cid1 = nodes[1]
        const out0 = [cid1]

        Graph.add(graph, cid0, out0)

        assert.deepEqual(
          graph.get(cid0),
          muteNode({ out: new Set([cid1.toString()]) })
        )
        assert.deepEqual(
          graph.get(cid1),
          missNode({ in: new Set([cid0.toString()]) })
        )
      })

      it('returns undefined if cid is not a vertex in the graph', () => {
        const graph = Graph.init()
        const cid0 = nodes[0]
        const cid1 = nodes[1]
        const cid2 = nodes[2]
        const out0 = [cid1]

        Graph.add(graph, cid0, out0)

        assert.equal(graph.get(cid2), undefined)
      })
    })

    describe('size', () => {
      it('returns the number of vertexes in the graph', () => {
        const graph = Graph.init()
        const cid0 = nodes[0]
        const out0 = [nodes[1]]

        Graph.add(graph, cid0, out0)

        assert.equal(graph.size, 1)
      })
    })
  })
})
