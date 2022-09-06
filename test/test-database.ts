import { strict as assert } from "assert";

import { Database } from "../src/database/index.js";

import { Keyvalue as Store } from "../src/manifest/store/keyvalue.js";
import { StaticAccess as Access } from "../src/manifest/access/static.js";
import { Entry } from "../src/manifest/entry/index.js";
import { Identity } from "../src/manifest/identity/index.js";

import {
  getIpfs,
  getIdentity,
  writeManifest,
  getStorageReturn,
} from "./utils/index.js";
import { IPFS } from "ipfs";
import { Blocks } from "../src/mods/blocks.js";
import { Manifest } from "../src/manifest/index.js";

describe("Database", () => {
  let ipfs: IPFS,
    blocks: Blocks,
    storage: getStorageReturn,
    database: Database,
    manifest: Manifest,
    identity: Identity;

  before(async () => {
    ipfs = await getIpfs();
    blocks = new Blocks(ipfs);

    const obj = await getIdentity();

    storage = obj.storage;
    identity = obj.identity;

    manifest = await writeManifest({ access: { write: [identity.id] } });
  });

  after(async () => {
    await storage.close();
    await ipfs.stop();
  });

  describe("class", () => {
    it("exposes static properties", () => {
      assert.ok(Database.open);
    });

    describe("open", () => {
      it("returns a new Database instance", async () => {
        database = await Database.open({
          manifest,
          identity,
          blocks,
          Store,
          Access,
          Entry,
          Identity,
        });
      });
    });
  });

  describe("instance", () => {
    it("exposes instance properties", () => {
      assert.ok(database.blocks);
      assert.ok(database.identity);
      assert.ok(database.replica);
      assert.ok(database.manifest);
      assert.ok(database.store);
      assert.ok(database.access);
      assert.ok(database.Entry);
      assert.ok(database.Identity);
      // see about doing this with generics
      // assert.ok(database.put);
      // assert.ok(database.del);
      // assert.ok(database.get);
      assert.ok(database.events);
      assert.ok(database.open);
      assert.ok(database.close);
    });

    describe("close", () => {
      it("resets the database state", async () => {
        await database.close();
        assert.equal(database.open, false);
      });
    });
  });
});
