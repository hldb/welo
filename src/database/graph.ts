import EventEmitter from 'events'
import PQueue from 'p-queue'
import { HashMap, create, load, Loader, CreateOptions } from 'ipld-hashmap'
import { CID } from 'multiformats/cid'
import * as blockCodec from '@ipld/dag-cbor'
import { sha256 as blockHasher } from 'multiformats/hashes/sha2'

import { Blocks } from '../mods/blocks.js'
import { Playable } from '../utils/playable.js'
import { Node } from './graph-node.js'
import { cidstring } from '../utils/index.js'

const hashmapOptions: CreateOptions<typeof blockCodec.code, any> = {
  blockCodec,
  blockHasher,
  hashBytes: 32,
  bitWidth: 5,
  bucketSize: 3
}

export const loader = (blocks: Blocks): Loader => ({
  get: async (cid: CID): Promise<Uint8Array> =>
    await blocks.get(cid).then((b) => b.bytes),
  put: async (cid: CID, bytes: Uint8Array): Promise<void> => {
    const block = await blocks.decode<any>({ bytes })
    await blocks.put(block)
  }
})

export const loadHashMap = async <V>(blocks: Blocks, cid?: CID): Promise<HashMap<V>> =>
  cid != null
    ? await load(loader(blocks), cid, hashmapOptions)
    : await create(loader(blocks), hashmapOptions)

interface State {
  nodes: HashMap<Uint8Array>
  missing: HashMap<null> // used as sets
  denied: HashMap<null> // used as sets
  heads: HashMap<null> // used as sets
  tails: HashMap<null> // used as sets
}

interface Root {
  nodes: CID
  missing: CID
  denied: CID
  heads: CID
  tails: CID
}

const getState = async (blocks: Blocks, root?: Root): Promise<State> => ({
  nodes: await loadHashMap<Uint8Array>(blocks, root?.nodes),
  missing: await loadHashMap<null>(blocks, root?.missing),
  denied: await loadHashMap<null>(blocks, root?.denied),
  heads: await loadHashMap<null>(blocks, root?.heads),
  tails: await loadHashMap<null>(blocks, root?.tails)
})

const getRoot = (state: State): Root => ({
  nodes: state.nodes.cid,
  missing: state.missing.cid,
  denied: state.denied.cid,
  heads: state.heads.cid,
  tails: state.tails.cid
})

const getSize = async (blocks: Blocks, state: State): Promise<number> => {
  const toSize =
    <V>() =>
      async (hashmap: HashMap<V>): Promise<number> =>
        await hashmap.size()
  const [nodes, missing, denied] = await Promise.all([
    // grabs hashmap root cids synchronously
    loadHashMap<Uint8Array>(blocks, state.nodes.cid).then(toSize<Uint8Array>()),
    loadHashMap<null>(blocks, state.missing.cid).then(toSize<null>()),
    loadHashMap<null>(blocks, state.denied.cid).then(toSize<null>())
  ])

  return nodes - missing - denied
}

export class Graph extends Playable {
  blocks: Blocks
  _root: Root | null
  _state: State | null
  readonly events: EventEmitter
  readonly queue: PQueue

  constructor ({ blocks, root }: { blocks: Blocks, root?: Root }) {
    const starting = async (): Promise<void> => {
      this._state = await getState(blocks, root)
      this._root = getRoot(this._state)
    }
    const stopping = async (): Promise<void> => {
      await this.queue.onIdle()
      this._state = null
    }
    super({ starting, stopping })

    this.blocks = blocks
    this._root = root ?? null
    this._state = null
    this.events = new EventEmitter()
    this.queue = new PQueue({ concurrency: 1 })
  }

  clone (): Graph {
    return new Graph({ blocks: this.blocks, root: this._root ?? undefined })
  }

  get root (): Root {
    if (!this.isStarted()) {
      throw new Error()
    }

    return this._root as Root
  }

  get state (): State {
    if (!this.isStarted()) {
      throw new Error()
    }

    return this._state as State
  }

  get nodes (): HashMap<Uint8Array> {
    return this.state.nodes
  }

  get heads (): HashMap<null> {
    return this.state.heads
  }

  get tails (): HashMap<null> {
    return this.state.tails
  }

  get missing (): HashMap<null> {
    return this.state.missing
  }

  get denied (): HashMap<null> {
    return this.state.denied
  }

  async known (cid: CID | string): Promise<boolean> {
    return await this.nodes.has(cidstring(cid))
  }

  async get (cid: CID | string): Promise<Node | undefined> {
    return await get(this.state, cidstring(cid))
  }

  async has (cid: CID | string): Promise<boolean> {
    return Node.exists(await this.get(cid))
  }

  async size (): Promise<number> {
    return await getSize(this.blocks, this.state)
  }

  async add (cid: CID, out: CID[]): Promise<void> {
    const state = await getState(this.blocks, this.root)

    const func = async (): Promise<void> => {
      const newState = await add(state, cid, out)
      this._state = newState
      this._root = getRoot(this.state)
    }

    await this.queue.add(func)
    this.events.emit('add', cid)
  }

  async miss (cid: CID): Promise<void> {
    const state = await getState(this.blocks, this.root)

    const func = async (): Promise<void> => {
      const newState = await remove(state, cid, missing)
      this._state = newState
      this._root = getRoot(this.state)
    }

    await this.queue.add(func)
    this.events.emit('miss', cid)
  }

  async deny (cid: CID): Promise<void> {
    const state = await getState(this.blocks, this.root)

    const func = async (): Promise<void> => {
      const newState = await remove(state, cid, denied)
      this._state = newState
      this._root = getRoot(this.state)
    }

    await this.queue.add(func)
    this.events.emit('deny', cid)
  }
}

/**
 *
 * -REAL SHIT-
 *
 */

export async function get (
  state: State,
  cid: string
): Promise<Node | undefined> {
  const value = await state.nodes.get(cid)

  return value instanceof Uint8Array ? await Node.decode(value) : undefined
}

export async function set (
  state: State,
  cid: string,
  node: Node
): Promise<void> {
  const block = await node.encode()
  return await state.nodes.set(cid, block.bytes)
}

export async function add (state: State, cid: CID, out: CID[]): Promise<State> {
  // could serialize operations based on add CID
  // for no duplicate adds concurrently
  const string = cidstring(cid)
  let node = await get(state, string)

  // nodes are immutable, no reason to update their out edges
  if (Node.exists(node)) {
    return state
  } else if (node === undefined) {
    node = Node.init()
  }

  const seen: Set<string> = new Set([string]) // handle self references
  const existing: Set<string> = new Set() // set of references with existing nodes

  // add node cid to the node of each cid in out
  for (const _cid of out) {
    const _string = cidstring(_cid)

    // no duplicate mutations; no self references
    if (seen.has(_string)) {
      continue
    }
    seen.add(_string)

    node.out.add(_string)

    let _node = await get(state, _string)
    if (_node === undefined) {
      _node = Node.init()
      _node.missing = true
    }

    if (Node.exists(_node)) {
      existing.add(_string)
    }

    if (_node.missing === true) {
      await state.missing.set(_string, null)
    }

    _node.in.add(string)
    const block = await _node.encode()

    await state.nodes.set(_string, block.bytes)
  }

  if (node.missing === true) {
    node.missing = false
    await state.missing.delete(string)
  }

  if (node.denied === true) {
    node.denied = false
    await state.denied.delete(string)
  }

  // update heads

  if (node.in.size === 0) {
    await state.heads.set(string, null)
  }
  for (const _string of existing) {
    // this is not exact
    await state.heads.delete(_string)
  }

  // update tails

  if (existing.size === 0) {
    await state.tails.set(string, null)
  }
  for (const _string of node.in) {
    // this is not exact
    await state.tails.delete(_string)
  }

  const block = await node.encode()
  await state.nodes.set(string, block.bytes)

  return state
}

const missing = 'missing'
const denied = 'denied'

type Reason = typeof missing | typeof denied

export async function remove (
  state: State,
  cid: CID | string,
  reason: Reason
): Promise<State> {
  const string = cidstring(cid)

  //  reason === missing
  let unreason: Reason = denied

  if (reason === denied) {
    unreason = missing
  }

  const node = await get(state, string)
  if (node === undefined || node[reason] === true) {
    return state
  }
  const exists = Node.exists(node)

  // remove in reference to node from all nodes referenced in node.out
  // update heads

  if (exists && (await state.heads.has(string))) {
    await state.heads.delete(string)
  }

  for (const _string of node.out) {
    const _node = (await get(state, _string)) as Node
    const _exists = Node.exists(_node)

    _node.in.delete(string)

    await set(state, _string, _node)
    if (_node.in.size === 0) {
      if (_exists) {
        await state.heads.set(_string, null)
      } else {
        // remove referenced orphaned node
        await state.nodes.delete(_string)
        _node.missing === true && await state.missing.delete(_string)
        _node.denied === true && await state.denied.delete(_string)
      }
    }
  }

  // update tails

  if (exists && (await state.tails.has(string))) {
    await state.tails.delete(string)

    for (const _string of node.in) {
      const _node = (await get(state, _string)) as Node

      let tail = true
      for (const _string of _node.out) {
        if (
          _string !== string &&
          !(
            (await state.missing.has(_string)) ||
            (await state.denied.has(_string))
          )
        ) {
          tail = false
          break
        }
      }

      if (tail) {
        await state.tails.set(_string, null)
      }
    }
  }

  // update or remove node

  // miss -> deny | deny -> miss
  if (node[unreason] === true) {
    node[unreason] = false
    await state[unreason].delete(string)
  }

  // node is orphaned
  if (node.in.size === 0) {
    await state.nodes.delete(string)
  } else {
    node[reason] = true
    node.out.clear()

    await state[reason].set(string, null)
    await set(state, string, node)
  }

  return state
}
