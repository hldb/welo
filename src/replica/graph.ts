import { EventEmitter, CustomEvent } from '@libp2p/interfaces/events'
import PQueue from 'p-queue'
import { HashMap, create, load, type Loader, CreateOptions } from 'ipld-hashmap'
import * as blockCodec from '@ipld/dag-cbor'
import { sha256 as blockHasher } from 'multiformats/hashes/sha2'
import { Key } from 'interface-datastore'
import { CodeError } from '@libp2p/interfaces/errors'
import type { CID } from 'multiformats/cid'
import type { ShardLink } from '@alanshaw/pail/shard'
import type { Blockstore } from 'interface-blockstore'

import { Playable } from '@/utils/playable.js'
import { cidstring } from '@/utils/index.js'
import type { Blocks } from '@/blocks/index.js'

import { Node } from './graph-node.js'
import { empty as emptyBytes } from 'multiformats/bytes'
import { Paily } from '@/utils/paily.js'
import type { IpldDatastore } from '@/utils/paily.js'

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
  put: async (_: CID, bytes: Uint8Array): Promise<void> => {
    const block = await blocks.decode<any>({ bytes })
    await blocks.put(block)
  }
})

export const loadHashMap = async <V>(
  blocks: Blocks,
  cid?: CID
): Promise<HashMap<V>> =>
  cid != null
    ? await load(loader(blocks), cid, hashmapOptions)
    : await create(loader(blocks), hashmapOptions)

type StateKeys = 'nodes' | 'missing' | 'denied' | 'heads' | 'tails'

const stateKeys: StateKeys[] = ['nodes', 'missing', 'denied', 'heads', 'tails']

type GraphState = {
  [K in StateKeys]: IpldDatastore<ShardLink>
}

export type GraphRoot = {
  [K in StateKeys]: ShardLink
}

const createState = async (blockstore: Blockstore, root?: GraphRoot): Promise<GraphState> =>
  ({
    nodes: await Paily.create(blockstore),
    missing: await Paily.create(blockstore),
    denied: await Paily.create(blockstore),
    heads: await Paily.create(blockstore),
    tails: await Paily.create(blockstore)
  })

const openState = (blockstore: Blockstore, root: GraphRoot): GraphState =>
  ({
    nodes: Paily.open(blockstore, root.nodes),
    missing: Paily.open(blockstore, root.missing),
    denied: Paily.open(blockstore, root.denied),
    heads: Paily.open(blockstore, root.heads),
    tails: Paily.open(blockstore, root.tails)
  })

const getRoot = (state: GraphState): GraphRoot =>
  ({
    nodes: state.nodes.root,
    missing: state.missing.root,
    denied: state.denied.root,
    heads: state.heads.root,
    tails: state.tails.root
  })

interface GraphChangeData {
  cid: CID
}

interface GraphEvents {
  add: CustomEvent<GraphChangeData>
  miss: CustomEvent<GraphChangeData>
  deny: CustomEvent<GraphChangeData>
}

export class Graph extends Playable {
  blockstore: Blockstore
  _root: GraphRoot | null
  _state: GraphState | null
  readonly events: EventEmitter<GraphEvents>
  readonly queue: PQueue

  constructor (blockstore: Blockstore, root?: GraphRoot) {
    const starting = async (): Promise<void> => {
      this._state = root != null
        ? openState(blockstore, root)
        : await createState(blockstore)
      this._root = getRoot(this._state)
    }
    const stopping = async (): Promise<void> => {
      await this.queue.onIdle()
      this._state = null
    }
    super({ starting, stopping })

    this.blockstore = blockstore
    this._root = root ?? null
    this._state = null
    this.events = new EventEmitter()
    this.queue = new PQueue({ concurrency: 1 })
  }

  clone (): Graph {
    if (this._root == null) {
      throw new Error('cannot clone graph without root')
    }

    return new Graph(this.blockstore, this._root)
  }

  equals (graph: Graph): boolean {
    for (const k of stateKeys) {
      if (!this.root[k].equals(graph.root[k])) {
        return false
      }
    }

    return true
  }

  get root (): GraphRoot {
    if (this._root == null) {
      throw new Error('failed to read graph root')
    }

    return this._root
  }

  get state (): GraphState {
    if (this._state == null) {
      throw new Error('failed to read graph state')
    }

    return this._state
  }

  get nodes (): IpldDatastore<ShardLink> {
    return this.state.nodes
  }

  get heads (): IpldDatastore<ShardLink> {
    return this.state.heads
  }

  get tails (): IpldDatastore<ShardLink> {
    return this.state.tails
  }

  get missing (): IpldDatastore<ShardLink> {
    return this.state.missing
  }

  get denied (): IpldDatastore<ShardLink> {
    return this.state.denied
  }

  async known (cid: CID | string): Promise<boolean> {
    return await this.nodes.has(new Key(cidstring(cid)))
  }

  async get (cid: CID | string): Promise<Node | undefined> {
    return await get(this.state, cidstring(cid))
  }

  async has (cid: CID | string): Promise<boolean> {
    return Node.exists(await this.get(cid))
  }

  async add (cid: CID, out: CID[]): Promise<void> {
    const state = openState(this.blockstore, this.root)

    const func = async (): Promise<void> => {
      const newState = await add(state, cid, out)
      this._state = newState
      this._root = getRoot(this.state)
    }

    await this.queue.add(func)
    this.events.dispatchEvent(
      new CustomEvent<GraphChangeData>('add', { detail: { cid } })
    )
  }

  async miss (cid: CID): Promise<void> {
    const state = openState(this.blockstore, this.root)

    const func = async (): Promise<void> => {
      const newState = await remove(state, cid, missing)
      this._state = newState
      this._root = getRoot(this.state)
    }

    await this.queue.add(func)
    this.events.dispatchEvent(
      new CustomEvent<GraphChangeData>('miss', { detail: { cid } })
    )
  }

  async deny (cid: CID): Promise<void> {
    const state = openState(this.blockstore, this.root)

    const func = async (): Promise<void> => {
      const newState = await remove(state, cid, denied)
      this._state = newState
      this._root = getRoot(this.state)
    }

    await this.queue.add(func)
    this.events.dispatchEvent(
      new CustomEvent<GraphChangeData>('deny', { detail: { cid } })
    )
  }
}

/**
 *
 * -REAL SHIT-
 *
 */

export async function get (
  state: GraphState,
  cid: string
): Promise<Node | undefined> {
  try {
    const value = await state.nodes.get(new Key(cid))
    return await Node.decode(value)
  } catch (e) {
    if (e instanceof CodeError && e.code === 'ERR_NOT_FOUND') {
      return undefined
    }

    throw e
  }
}

export async function set (
  state: GraphState,
  cid: string,
  node: Node
): Promise<void> {
  const block = await node.encode()
  await state.nodes.put(new Key(cid), block.bytes)
}

export async function add (state: GraphState, cid: CID, out: CID[]): Promise<GraphState> {
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
      await state.missing.put(new Key(_string), emptyBytes)
    }

    _node.in.add(string)
    const block = await _node.encode()

    await state.nodes.put(new Key(_string), block.bytes)
  }

  if (node.missing === true) {
    node.missing = false
    await state.missing.delete(new Key(string))
  }

  if (node.denied === true) {
    node.denied = false
    await state.denied.delete(new Key(string))
  }

  // update heads

  if (node.in.size === 0) {
    await state.heads.put(new Key(string), emptyBytes)
  }
  for (const _string of existing) {
    // this is not exact
    await state.heads.delete(new Key(_string))
  }

  // update tails

  if (existing.size === 0) {
    await state.tails.put(new Key(string), emptyBytes)
  }
  for (const _string of node.in) {
    // this is not exact
    await state.tails.delete(new Key(_string))
  }

  const block = await node.encode()
  await state.nodes.put(new Key(string), block.bytes)

  return state
}

const missing = 'missing'
const denied = 'denied'

type Reason = typeof missing | typeof denied

export async function remove (
  state: GraphState,
  cid: CID | string,
  reason: Reason
): Promise<GraphState> {
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

  if (exists && (await state.heads.has(new Key(string)))) {
    await state.heads.delete(new Key(string))
  }

  for (const _string of node.out) {
    const _node = (await get(state, _string)) as Node
    const _exists = Node.exists(_node)

    _node.in.delete(string)

    await set(state, _string, _node)
    if (_node.in.size === 0) {
      if (_exists) {
        await state.heads.put(new Key(_string), emptyBytes)
      } else {
        // remove referenced orphaned node
        await state.nodes.delete(new Key(_string))
        _node.missing === true && (await state.missing.delete(new Key(_string)))
        _node.denied === true && (await state.denied.delete(new Key(_string)))
      }
    }
  }

  // update tails

  if (exists && (await state.tails.has(new Key(string)))) {
    await state.tails.delete(new Key(string))

    for (const _string of node.in) {
      const _node = (await get(state, _string)) as Node

      let tail = true
      for (const _string of _node.out) {
        if (
          _string !== string &&
          !(
            (await state.missing.has(new Key(_string))) ||
            (await state.denied.has(new Key(_string)))
          )
        ) {
          tail = false
          break
        }
      }

      if (tail) {
        await state.tails.put(new Key(_string), emptyBytes)
      }
    }
  }

  // update or remove node

  // miss -> deny | deny -> miss
  if (node[unreason] === true) {
    node[unreason] = false
    await state[unreason].delete(new Key(string))
  }

  // node is orphaned
  if (node.in.size === 0) {
    await state.nodes.delete(new Key(string))
  } else {
    node[reason] = true
    node.out.clear()

    await state[reason].put(new Key(string), emptyBytes)
    await set(state, string, node)
  }

  return state
}
