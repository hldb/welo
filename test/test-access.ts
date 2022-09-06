import { strict as assert } from "assert";
import { base32 } from "multiformats/bases/base32";
import { Entry } from "src/manifest/entry/index.js";
import { Identity } from "src/manifest/identity/index.js";
import { StorageReturn } from "src/mods/storage.js";

import { StaticAccess } from "../src/manifest/access/static.js";

import {
  getStorageReturn,
  getIdentity,
  singleEntry,
  writeManifest,
} from "./utils/index.js";
import { AccessOptions } from "./utils/types.js";

describe("Static Access", () => {
  let storage: getStorageReturn, identity: Identity, entry: Entry;
  const Access = StaticAccess;
  const expectedType = "static";

  let yesaccess: AccessOptions;
  const anyaccess: AccessOptions = { type: Access.type, write: ["*"] };
  const noaccess: AccessOptions = {
    type: Access.type,
    write: [new Uint8Array()],
  };
  const emptyaccess: AccessOptions = { type: Access.type, write: [] };

  before(async () => {
    const obj = await getIdentity();

    storage = obj.storage;
    identity = obj.identity;
    entry = await singleEntry(identity)();
    yesaccess = { type: Access.type, write: [identity.id] };
  });

  after(async () => {
    await storage.close();
  });

  describe("Class", () => {
    it("exposes static properties", () => {
      assert.equal(Access.type, expectedType);
    });

    describe(".open", () => {
      it("returns an instance of Static Access", async () => {
        const manifest = await writeManifest({ access: yesaccess });
        const access = await Access.open({ manifest });
        assert.equal(access.manifest, manifest);
        assert.deepEqual(access.write, new Set([base32.encode(identity.id)]));
      });

      it("returns an instance with a wildcard write", async () => {
        const manifest = await writeManifest({ access: anyaccess });
        const access = await Access.open({ manifest });
        assert.equal(access.manifest, manifest);
        assert.deepEqual(access.write, new Set(anyaccess.write));
      });

      it("rejects when write access is empty", async () => {
        const manifest = await writeManifest({ access: emptyaccess });
        assert.rejects(() => Access.open({ manifest }));
      });
    });
  });

  describe("Instance", () => {
    it("exposes instance properties", async () => {
      const manifest = await writeManifest({ access: yesaccess });
      const access = await Access.open({ manifest });
      assert.equal(access.manifest, manifest);
      assert.deepEqual(access.write, new Set([base32.encode(identity.id)]));
    });

    describe(".canAppend", () => {
      it("returns true if identity has write access", async () => {
        const manifest = await writeManifest({ access: yesaccess });
        const access = await Access.open({ manifest });
        assert.equal(await access.canAppend(entry), true);
      });

      it("returns true if wildcard has write access", async () => {
        const manifest = await writeManifest({ access: anyaccess });
        const access = await Access.open({ manifest });
        assert.equal(await access.canAppend(entry), true);
      });

      it("returns false if identity has no write access", async () => {
        const manifest = await writeManifest({ access: noaccess });
        const access = await Access.open({ manifest });
        assert.equal(await access.canAppend(entry), false);
      });
    });
  });
});
