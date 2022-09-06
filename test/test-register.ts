import { strict as assert } from "assert";

import { Register } from "../src/registry.js";

const components = {
  one: { type: "1" },
  two: { type: "2" },
  three: { type: "3" },
};

describe("Register", () => {
  let register: Register;

  describe("Class", () => {
    it("returns an instance", () => {
      register = new Register();
    });
  });

  describe("Instance", () => {
    it("exposes instance properties", () => {
      assert.ok(register.registered);
      assert.equal(register.starKey, Symbol.for("*"));
    });

    describe(".add", () => {
      it("registers an initial component", () => {
        register.add(components.one);
        assert.equal(register.registered[components.one.type], components.one);
        assert.equal(register.star, components.one);
      });

      it("registers a second component as star", () => {
        register.add(components.two, true);
        assert.equal(register.registered[components.two.type], components.two);
        assert.equal(register.star, components.two);
      });

      it("fails to re-register a component", () => {
        assert.throws(() => register.add(components.one));
      });
    });

    describe(".get", () => {
      it("grabs an existing component", () => {
        assert.equal(register.get(components.one.type), components.one);
      });

      it("fails to grab a non-existent component", () => {
        assert.throws(() => register.get(components.three.type));
      });
    });

    describe(".alias", () => {
      const alias = "alias";

      it("sets an alias for an existing component", () => {
        register.alias(components.one.type, alias);
        assert.equal(register.get(alias), components.one);
      });

      it("sets a component to star", () => {
        register.alias(components.one.type, register.starKey);
        assert.equal(register.star, components.one);
      });

      it("fails to set an alias for a non-existent component", () => {
        assert.throws(() => register.alias(components.three.type, alias));
      });
    });

    describe(".star", () => {
      it("grabs the star component", () => {
        assert.equal(register.star, components.one);
      });

      it("fails to grab non-existent star component", () => {
        const register = new Register();
        assert.throws(() => register.star);
      });
    });
  });
});
