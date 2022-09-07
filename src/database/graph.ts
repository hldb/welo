// Adjacency List Graph inside of a js Map with some stateful assistants

import type { CID } from 'multiformats/cid.js'
import { cidstring } from '../util.js'
const have = (node: Node | undefined) =>
  Boolean(node && !node.miss && !node.deny)

export type Edge = 'in' | 'out'

enum Reasons {
  miss = 'miss',
  deny = 'deny'
}

export interface GraphObj {
  nodes: Map<string, Node>
  // heads: Set<string> | undefined;
  // tails: Set<string> | undefined;
  missing: Set<string>
  denied: Set<string>
}
// nodes are where the vertices are kept as an adjacency list
// other properties are sets of cids which make up the graph border
// cids in missing and denied have a vertex in nodes that is missing or denied respectively
const initialGraph: GraphObj = {
  nodes: new Map(),
  // heads: new Set(),
  // tails: new Set(),
  missing: new Set(),
  denied: new Set()
}

class Graph implements GraphObj {
  nodes: Map<string, Node>
  // heads: Set<string>;
  // tails: Set<string>;
  missing: Set<string>
  denied: Set<string>

  constructor({
    nodes,
    // heads,
    // tails,
    missing,
    denied
  }: GraphObj = initialGraph) {
    this.nodes = new Map(nodes)
    // these become stateful later
    // this.heads = new Set(heads)
    // this.tails = new Set(tails)
    this.missing = new Set(missing)
    this.denied = new Set(denied)
  }

  static init() {
    return new Graph()
  }

  static clone(graph: Graph) {
    return new Graph(graph)
  }

  known(cid: CID | string) {
    return this.nodes.has(cidstring(cid))
  }

  // true if cid exists in this.nodes and is not missing or denied
  has(cid: CID | string) {
    return have(this.get(cid))
  }

  get(cid: CID | string) {
    return this.nodes.get(cidstring(cid))
  }

  get size() {
    return this.nodes.size - this.missing.size - this.denied.size
  }

  // stateless heads and tails for now

  get heads() {
    const heads: Set<string> = new Set()

    for (const [string, node] of this.nodes.entries()) {
      if (have(node) && !node.in.size) {
        heads.add(string)
      }
    }

    return heads
  }

  get tails() {
    // this sucks; necessary to make stateful
    const tails: Set<string> = new Set()

    for (const [string, node] of this.nodes.entries()) {
      if (!have(node)) {
        continue
      }

      let tail = true
      for (const string of node.out) {
        // if one of the cid in node.out are not missing or denied, then node is not a tail
        if (!(this.missing.has(string) || this.denied.has(string))) {
          tail = false
          break
        }
      }

      if (tail) tails.add(string)
    }

    return tails
  }

  // write methods

  static add(graph: Graph, cid: CID | string, out: CID[] | string[]) {
    const node = graph.get(cid)
    const clone = Node.clone(node)

    if (have(node)) {
      return
    }

    const string = cidstring(cid)
    const seen: Set<string> = new Set()

    // handle self references
    seen.add(string)

    // add node cid to the node of each cid in out
    for (const _cid of out) {
      const _string = cidstring(_cid)

      // no duplicate mutations; no self references
      if (seen.has(_string)) {
        continue
      }

      clone.out.add(_string)

      const _node = graph.get(_string)
      const _clone = Node.clone(_node)
      _clone.in.add(string)

      graph.nodes.set(_string, _clone)

      // if node was unknown then add to missing
      if (_node == null) {
        this.miss(graph, _string)
      }
    }

    clone.miss = false
    clone.deny = false
    graph.missing.delete(string)
    graph.denied.delete(string)

    graph.nodes.set(string, clone)

    // this._statefulAdd(graph, clone)
    // this.events.emit('add', cid)
  }

  static miss(graph: Graph, cid: CID | string) {
    this._rm(graph, cid, Reasons.miss)
    // this.events.emit(reasons.miss, cid)
  }

  static deny(graph: Graph, cid: CID | string) {
    this._rm(graph, cid, Reasons.deny)
    // this.events.emit(reasons.deny, cid)
  }

  static _rm(graph: Graph, cid: CID | string, reason: Reasons) {
    const string = cidstring(cid)

    // missing or denied based on reason
    const mord = reason === Reasons.miss ? graph.missing : graph.denied

    // clean this up later
    const unreason = reason === Reasons.miss ? Reasons.deny : Reasons.miss
    const dorm = mord === graph.missing ? graph.denied : graph.missing

    const node = graph.get(cid)
    if (node == null || node[reason]) {
      return
    } else if (!node.in.size) {
      // erase orphaned node
      graph.nodes.delete(string)
      graph.missing.delete(string)
      graph.denied.delete(string)
    } else {
      // add node cid to missing or denied
      mord.add(string)
      dorm.delete(string)
      const clone = Node.clone(node)
      clone.out.clear()
      clone[reason] = true
      clone[unreason] = false
      graph.nodes.set(string, clone)
    }

    for (const _string of node.out) {
      const _node = graph.get(_string)
      const _clone = Node.clone(_node)

      _clone.in.delete(string)
      graph.nodes.set(_string, _clone)

      if (!_clone.in.size) {
        this[reason](graph, _string)
      }
    }
    // this._statefulRm(graph, node)
  }

  // these will keep graph.heads and .tails up to date

  // static _statefulAdd(graph, node) {}

  // static _statefulRm(graph, node) {}
}

export interface NodeObj {
  in: Set<string>
  out: Set<string>
  miss: Boolean
  deny: Boolean
}

// a non-missing or non-denied node can have empty sets for out and in
// a missing or denied node will always have out equal to an empty set
// a missing or denied node will always have in equal to a non empty set
export const initialNode: NodeObj = {
  in: new Set(),
  out: new Set(),
  miss: false,
  deny: false
}

class Node implements NodeObj {
  in: Set<string>
  out: Set<string>
  miss: Boolean
  deny: Boolean

  // 'ni' because 'in' is a token
  constructor({ in: ni, out, miss, deny }: NodeObj = initialNode) {
    this.in = new Set(ni)
    this.out = new Set(out)
    this.miss = Boolean(miss)
    this.deny = Boolean(deny)
  }

  static init() {
    return new Node()
  }

  static clone(node: Node | undefined) {
    return new Node(node)
  }
}

// Node is mostly exported for tests
export { Graph, Node }
