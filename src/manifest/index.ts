import type { Block } from "multiformats/block.js";
import { RegistryObj } from "src/registry.js";
import { Blocks } from "../mods/blocks.js";
import { Address } from "./address.js";

export interface ManifestObj {
  version?: number;
  name?: string;
  store?: any;
  access?: any;
  entry?: any;
  identity?: any;
  meta?: any;
  tag?: Uint8Array;
}

class Manifest implements ManifestObj {
  version?: number;
  name?: string;
  store?: any;
  access?: any;
  entry?: any;
  identity?: any;
  meta?: any;
  tag: Uint8Array;

  constructor(readonly block: Block<ManifestObj>) {
    const manifest = block.value;
    if (manifest.version) this.version = manifest.version;
    if (manifest.store) this.store = manifest.store;
    if (manifest.access) this.access = manifest.access;
    if (manifest.entry) this.entry = manifest.entry;
    if (manifest.identity) this.identity = manifest.identity;
    if (manifest.meta) this.meta = manifest.meta;
    if (manifest.tag) {
      this.tag = manifest.tag;
    } else {
      this.tag = block.cid.bytes;
    }
  }

  static async create(manifest: ManifestObj) {
    const block = await Blocks.encode({ value: manifest });
    return new Manifest(block);
  }

  static async fetch({
    blocks,
    address,
  }: {
    blocks: Blocks;
    address: Address;
  }) {
    const block = await blocks.get(address.cid);
    return this.asManifest({ block }, true);
  }

  static async asManifest(manifest: any, force = false) {
    if (manifest instanceof Manifest) {
      return manifest;
    }

    try {
      const { block } = manifest;
      return new Manifest(block);
    } catch (e) {
      if (force) {
        throw new Error(
          `unable to coerce to manifest from: ${JSON.stringify(manifest)}`
        );
      }
      // todo: handle other errors differently

      return null;
    }
  }

  static getComponents(registry: RegistryObj, manifest: Manifest) {
    return {
      Store: registry.store.get(manifest.store.type),
      Access: registry.access.get(manifest.access.type),
      Entry: registry.entry.get(manifest.entry.type),
      Identity: registry.identity.get(manifest.identity.type),
    };
  }

  get address() {
    return new Address(this.block.cid);
  }
}

export { Manifest, Address };
function enumberable(arg0: boolean) {
  throw new Error("Function not implemented.");
}
