import EventEmitter from "events";
import { CID } from "multiformats/cid";
import { StaticAccess } from "src/manifest/access/static.js";
import { Entry } from "src/manifest/entry/index.js";
import { Identity } from "src/manifest/identity/index.js";
import { Manifest } from "src/manifest/index.js";
import { Blocks } from "src/mods/blocks.js";
import { StorageReturn } from "src/mods/storage.js";
// import { compare } from 'uint8arrays/compare'
import { equals } from "uint8arrays/equals";

import { Edge, Graph } from "./graph.js";
import {
  loadEntry,
  graphLinks,
  sortEntries,
  sortEntriesRev,
  traverser,
} from "./traversal.js";

type EntryType = typeof Entry;
type IdentityType = typeof Identity;

interface ReplicaParams {
  manifest: Manifest;
  // storage: StorageReturn;
  blocks: Blocks;
  identity: Identity;
  access: StaticAccess;
  Entry: typeof Entry;
  Identity: typeof Identity;
  _graph: Graph;
}

export class Replica {
  readonly manifest: Manifest;
  // readonly storage: StorageReturn;
  readonly blocks: Blocks;
  readonly identity: Identity;
  readonly access: StaticAccess;
  readonly Entry: EntryType;
  readonly Identity: IdentityType;
  readonly _graph: Graph;
  readonly events: EventEmitter;

  constructor({
    manifest,
    // storage,
    blocks,
    access,
    identity,
    Entry,
    Identity,
    _graph,
  }: ReplicaParams) {
    this.manifest = manifest;
    // this.storage = storage // storage isnt used yet as states are not being persisted
    this.blocks = blocks;
    this.access = access;
    this.identity = identity;
    this.Entry = Entry;
    this.Identity = Identity;
    this._graph = _graph;

    this.events = new EventEmitter();
  }

  static async open({
    manifest,
    blocks,
    access,
    identity,
    Entry,
    Identity,
  }: Omit<ReplicaParams, "_graph">) {
    // const storage = createStorage('replica')
    // await storage.open()
    const _graph = Graph.init();

    return new Replica({
      manifest,
      blocks,
      access,
      identity,
      Entry,
      Identity,
      _graph,
    });
  }

  async close() {
    // await this.storage.close()
  }

  get heads() {
    return this._graph.heads;
  }
  get tails() {
    return this._graph.tails;
  }
  get missing() {
    return this._graph.missing;
  }
  get denied() {
    return this._graph.denied;
  }

  get size() {
    return this._graph.size;
  }

  traverse({ direction } = { direction: "descend" }) {
    const blocks = this.blocks;
    const Entry = this.Entry;
    const Identity = this.Identity;
    const graph = Graph.clone(this._graph);

    const headsAndTails = [graph.heads, graph.tails];

    let edge: Edge, orderFn;
    if (direction === "descend") {
      edge = "out";
      orderFn = sortEntries;
    } else if (direction === "ascend") {
      // heads and tails are switched if traversal is ascending
      headsAndTails.reverse();
      edge = "in";
      orderFn = sortEntriesRev;
    } else {
      throw new Error("unknown direction given");
    }
    // todo: less wordy way to assign heads and tails from direction
    const [heads, tails] = headsAndTails;

    const cids = Array.from(heads).map((string) => CID.parse(string));
    const load = loadEntry({ blocks, Entry, Identity });
    const links = graphLinks({ graph, tails, edge });

    return traverser({ cids, load, links, orderFn });
  }

  async has(cid: CID | string) {
    return this._graph.has(cid);
  }

  async known(cid: CID | string) {
    return this._graph.known(cid);
  }

  async add(entries: Entry[]) {
    for await (const entry of entries) {
      if (!equals(entry.tag, this.manifest.tag)) {
        console.warn("replica received entry with mismatched tag");
        continue;
      }

      await this.blocks.put(entry.block);

      if (this.access.canAppend(entry)) {
        Graph.add(this._graph, entry.cid, entry.next);
      } else {
        Graph.deny(this._graph, entry.cid);
      }
    }
    this.events.emit("update");
  }

  async write(payload: any) {
    const entry = await this.Entry.create({
      identity: this.identity,
      tag: this.manifest.tag,
      payload,
      next: Array.from(this.heads).map((string) => CID.parse(string)),
      refs: [], // refs are empty for now
    });

    await this.blocks.put(entry.block);

    // do not await
    const add = this.add([entry]);
    add.then(() => this.events.emit("write"));

    return add.then(() => entry);
  }

  // useful when the access list is updated
  // async deny (entries) {
  //   for await (const entry of entries) {
  //
  //   }
  // }
}
