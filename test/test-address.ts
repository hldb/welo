import { strict as assert } from "assert";
import { CID } from "multiformats/cid";
import { Address } from "../src/manifest/address.js";

describe("Address", () => {
  let address: Address;
  const prefix = "/opal/";
  const hash = "bafyreiewienqflf5skie6c5xlmasqj7ndj24qwt6fxkwqdwzggfmpdmqai";
  const string = prefix + hash;

  describe("Class", () => {
    it("exposes class properties", () => {
      assert.equal(Address.prefix, prefix);
    });

    describe(".asAddress", () => {
      it("returns an address from a cid", () => {
        address = Address.asAddress({ cid: CID.parse(hash) }) as Address;
        assert.equal(address.toString(), string);
      });

      it("returns the same instance if possible", () => {
        const _address = Address.asAddress(address);
        assert.equal(_address, address);
      });

      it("returns null if unable to coerce", () => {
        assert.equal(Address.asAddress(), null);
        assert.equal(Address.asAddress(""), null);
        assert.equal(Address.asAddress({ cid: hash }), null);
      });
    });

    describe(".fromString", () => {
      it("returns address from string", () => {
        address = Address.fromString(string);
        assert.equal(address.cid.toString(), hash);
      });

      it("throws given invalid string", () => {
        assert.throws(() => Address.fromString(""));
        assert.throws(() => Address.fromString(prefix));
        assert.throws(() => Address.fromString(hash));
      });
    });
  });

  describe("Instance", () => {
    it("exposes instance properties", () => {
      assert.equal(address.toString(), string);
    });

    it(".toString", () => {
      assert.equal(address.toString(), string);
    });

    describe(".equals", () => {
      it("returns true if the addresses are the same", () => {
        const _address = Address.fromString(string);
        assert.ok(address.equals(address));
        assert.ok(address.equals(_address));
      });

      it("returns false if the addresses are different", () => {
        const _hash =
          "bafyreib2caa6txg46uhpt43bgfnfk3wzfdbz4n2frn2brbrjtjuambgd6i";
        const _address = Address.fromString(prefix + _hash);
        assert.equal(address.equals(_address), false);
      });
    });
  });
});
