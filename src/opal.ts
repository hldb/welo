import EventEmitter from "events";
import where from "wherearewe";
import path from "path";

// import * as version from './version.js'
import { Manifest, Address, ManifestObj } from "./manifest/index.js";
import { Database } from "./database/index.js";
import { Blocks } from "./mods/blocks.js";
import { registry } from "./registry.js";
import { OPAL_LOWER } from "./constants.js";
import { dirs, DirsReturn } from "./util.js";

import type { Storage, StorageReturn } from "./mods/storage.js";
import type { Keychain } from "./keychain/index.js";
import type { Replicator } from "./replicator/index.js";
import type { Identity } from "./manifest/identity/index.js";
import type { IPFS } from "ipfs";
import type { PeerId } from "@libp2p/interface-peer-id";
import type { PubSub } from "@libp2p/interface-pubsub";
type IdentityType = typeof Identity;

interface OpalStorage {
  identities: StorageReturn;
  keychain: StorageReturn;
}
interface OpalShared {
  directory?: string;
  identity?: Identity | undefined;
  storage?: OpalStorage;
  identities?: StorageReturn | undefined;
  keychain?: Keychain | undefined;
}

interface OpalConfig extends OpalShared {
  directory: string;
  identity: Identity;
  blocks: Blocks;
  peerId?: PeerId;
  pubsub?: PubSub;
}

interface OpalOptions extends OpalShared {
  ipfs?: IPFS;
}

interface OpenOptions {
  identity?: Identity;
  Storage?: StorageReturn;
  Replicator?: typeof Replicator;
}

// database factory
class Opal {
  static Storage?: Storage;
  static Keychain?: typeof Keychain;
  static Replicator?: typeof Replicator;

  directory: string;
  identity: Identity;
  blocks: Blocks;
  events: EventEmitter;

  storage?: OpalStorage;
  identities?: StorageReturn;
  keychain?: Keychain;

  opened: {
    [address: string]: Database;
  };

  ipfs?: IPFS;
  peerId?: PeerId;
  pubsub?: PubSub;

  private dirs: DirsReturn;
  private _opening: {
    [address: string]: Promise<Database>;
  };

  constructor({
    directory,
    identity,
    storage,
    identities,
    keychain,
    blocks,
    peerId,
    pubsub,
  }: OpalConfig) {
    this.directory = directory;
    this.dirs = dirs(this.directory);

    this.identity = identity;
    this.storage = storage;
    this.identities = identities;
    this.keychain = keychain;

    this.blocks = blocks;
    this.peerId = peerId;
    this.pubsub = pubsub;

    this.events = new EventEmitter();

    this.opened = {};
    this._opening = {};
  }

  static async create(options: OpalOptions = {}) {
    let directory;
    if (where.isNode) {
      directory = path.resolve(options.directory || OPAL_LOWER);
    } else {
      directory = OPAL_LOWER;
    }

    let identity, identities, keychain, storage;

    if (options.identity) {
      identity = options.identity;
    } else {
      if (this.Storage === undefined || this.Keychain === undefined) {
        throw new Error(
          "Opal.create: missing Storage and Keychain; unable to create Identity"
        );
      }

      const _storage: OpalStorage = {
        identities: await this.Storage(dirs(directory).identities),
        keychain: await this.Storage(dirs(directory).chain),
      };
      storage = _storage;
      await _storage.identities.open();
      await _storage.keychain.open();

      identities = storage.identities;
      keychain = new this.Keychain(
        { getDatastore: () => _storage.keychain },
        {}
      );

      const Identity: IdentityType = this.registry.identity.star;
      identity = await Identity.get({
        name: "default",
        identities: identities,
        keychain: keychain,
      });
    }

    const config: OpalConfig = {
      directory,
      identity,
      storage,
      identities,
      keychain,
      blocks: new Blocks(options.ipfs),
      // peerId and pubsub is not required but for some replicators
      // peerId: options.peerId || null,
      // pubsub: options.pubsub || options.ipfs.pubsub || null
    };

    return new Opal(config);
  }

  // static get version () { return version }

  static get Manifest() {
    return Manifest;
  }

  static get registry() {
    return registry;
  }
  get registry() {
    return registry;
  }

  async stop() {
    await Promise.all(Object.values(this._opening));
    await Promise.all(Object.values(this.opened).map((db) => db.close()));

    this.events.emit("stop");
    this.events.removeAllListeners("opened");
    this.events.removeAllListeners("closed");

    if (this.storage) {
      await this.storage.identities.close();
      await this.storage.keychain.close();
    }
  }

  async determineManifest(name: string, options: ManifestObj = {}) {
    // clean this up
    const opts = {
      version: 1,
      store: {
        type: this.registry.store.star.type,
      },
      access: {
        type: this.registry.access.star.type,
        write: [this.identity.id],
      },
      entry: {
        type: this.registry.entry.star.type,
      },
      identity: {
        type: this.registry.identity.star.type,
      },
      ...options,
    };

    const manifest = await Manifest.create({ name, ...opts });
    await this.blocks.put(manifest.block);

    try {
      Manifest.getComponents(this.registry, manifest);
    } catch (e) {
      console.warn("manifest configuration contains unregistered components");
    }

    return manifest;
  }

  async fetchManifest(address: Address) {
    return Manifest.fetch({ blocks: this.blocks, address });
  }

  async open(manifest: Manifest, options: OpenOptions = {}) {
    const address = manifest.address;
    const string = address.toString();

    const isOpen = this.opened[string] || this._opening[string];

    if (isOpen) {
      throw new Error(`database ${address} is already open or being opened`);
    }

    const components = Manifest.getComponents(this.registry, manifest);

    // this will return a duplicate instance of the identity (not epic) until the instances cache is used by Identity.get
    const identity =
      options.identity ||
      (await components.Identity.get({
        name: "default",
        identities: this.identities,
        keychain: this.keychain,
      }));

    // const Storage = options.Storage || Opal.Storage
    const Replicator = options.Replicator || Opal.Replicator;

    // const location = path.join(this.dirs.databases, manifest.address.cid.toString(base32))

    // not worrying about persistent databases for now
    // const createStorage = name => new Storage(path.join(location, name), this.storageOps)
    // const createStorage = () => {};

    this._opening[string] = Database.open({
      manifest,
      blocks: this.blocks,
      // peerId: this.peerId,
      // pubsub: this.pubsub,
      identity,
      // Replicator,
      // createStorage,
      ...Manifest.getComponents(this.registry, manifest),
    })
      .then((db) => {
        this.opened[string] = db;
        delete this._opening[string];
        this.events.emit("opened", db);
        db.events.once("closed", () => {
          delete this.opened[string];
          this.events.emit("closed", db);
        });
        return db;
      })
      .catch((e) => {
        console.error(e);
        throw new Error(`failed opening database with address: ${address}`);
      });

    return this._opening[string];
  }
}

export { Opal };
