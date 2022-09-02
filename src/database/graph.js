
// Adjacency List Graph inside of a js Map with some stateful assistants

import { cidstring } from '../util.js'
const have = node => node && !node.miss && !node.deny
const reasons = Object.fromEntries(['miss', 'deny'].map(k => [k, k]))

// nodes are where the vertices are kept as an adjacency list
// other properties are sets of cids which make up the graph border
// cids in missing and denied have a vertex in nodes that is missing or denied respectively
const initialGraph = {
  nodes: new Map(),
  heads: new Set(),
  tails: new Set(),
  missing: new Set(),
  denied: new Set()
}

class Graph {
  constructor ({ nodes, heads, tails, missing, denied } = initialGraph) {
    this.nodes = new Map(nodes)
    // these become stateful later
    // this.heads = new Set(heads)
    // this.tails = new Set(tails)
    this.missing = new Set(missing)
    this.denied = new Set(denied)
  }

  static init () {
    return new Graph()
  }

  static clone (graph) {
    return new Graph(graph)
  }

  known (cid) {
    return this.nodes.has(cidstring(cid))
  }

  // true if cid exists in this.nodes and is not missing or denied
  has (cid) {
    return have(this.get(cidstring(cid)))
  }

  get (cid) {
    return this.nodes.get(cidstring(cid))
  }

  get size () {
    return this.nodes.size - this.missing.size - this.denied.size
  }

  // stateless heads and tails for now

  get heads () {
    const heads = new Set()

    for (const [string, node] of this.nodes.entries()) {
      if (have(node) && !node.in.size) {
        heads.add(string)
      }
    }

    return heads
  }

  get tails () {
    // this sucks; necessary to make stateful
    const tails = new Set()

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

  // out must be a Set of cids
  static add (graph, cid, out) {
    const string = cidstring(cid)

    const node = graph.get(string)
    const clone = Node.clone(node)

    if (have(node)) {
      return
    }

    // add node cid to the node of each cid in out
    for (const _cid of out) {
      const _string = cidstring(_cid)
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

  static miss (graph, cid) {
    this._rm(graph, cid, reasons.miss)
    // this.events.emit(reasons.miss, cid)
  }

  static deny (graph, cid) {
    this._rm(graph, cid, reasons.deny)
    // this.events.emit(reasons.deny, cid)
  }

  static _rm (graph, cid, reason) {
    const string = cidstring(cid)

    // missing or denied based on reason
    const mord = reason === reasons.miss
      ? graph.missing
      : graph.denied

    // clean this up later
    const unreason = reason === reasons.miss
      ? reasons.deny
      : reasons.miss
    const dorm = mord === graph.missing
      ? graph.denied
      : graph.missing

    const node = graph.get(string)
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

  static _statefulAdd (graph, node) {}

  static _statefulRm (graph, node) {}
}

// a non-missing or non-denied node can have empty sets for out and in
// a missing or denied node will always have out equal to an empty set
// a missing or denied node will always have in equal to a non empty set
const initialNode = {
  in: new Set(),
  out: new Set(),
  miss: false,
  deny: false
}

class Node {
  // 'ni' because 'in' is a token
  constructor ({ in: ni, out, miss, deny } = initialNode) {
    this.in = new Set(ni)
    this.out = new Set(out)
    this.miss = Boolean(miss)
    this.deny = Boolean(deny)
  }

  static init () {
    return new Node()
  }

  static clone (node) {
    return new Node(node)
  }
}

// Node is mostly exported for tests
export { Graph, Node }
