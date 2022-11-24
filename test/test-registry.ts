import { strict as assert } from 'assert'

import { initRegistry } from '~registry/index.js'
import { Register } from '~registry/register.js'
import type { Registrant } from '~registry/registrant.js'

const testName = 'register'

describe(testName, () => {
  let register: Register<Registrant>

  const namespace = '/namespace/'

  const one: Registrant = { protocol: namespace + '1' }
  const two: Registrant = { protocol: namespace + '2' }
  const three: Registrant = { protocol: '3' }

  const components = { one, two, three }

  describe('Class', () => {
    it('returns an instance', () => {
      register = new Register(namespace)
    })
  })

  describe('Instance', () => {
    it('exposes instance properties', () => {
      assert.ok(register.registered)
      assert.equal(register.starKey, Symbol.for('*'))
    })

    describe('.add', () => {
      it('registers an initial component', () => {
        register.add(components.one)
        assert.equal(
          register.registered.get(components.one.protocol),
          components.one
        )
        assert.equal(register.star, components.one)
      })

      it('registers a second component as star', () => {
        register.add(components.two, true)
        assert.equal(
          register.registered.get(components.two.protocol),
          components.two
        )
        assert.equal(register.star, components.two)
      })

      it('fails to re-register a component', () => {
        assert.throws(() => register.add(components.one))
      })

      it('throws registering a component with namespace mistmatch', () => {
        assert.throws(() => register.add(components.three))
      })
    })

    describe('.get', () => {
      it('grabs an existing component', () => {
        assert.equal(register.get(components.one.protocol), components.one)
      })

      it('fails to grab a non-existent component', () => {
        assert.throws(() => register.get(components.three.protocol))
      })
    })

    describe('.alias', () => {
      const alias = 'alias'

      it('sets an alias for an existing component', () => {
        register.alias(components.one.protocol, alias)
        assert.equal(register.get(alias), components.one)
      })

      it('sets a component to star', () => {
        register.alias(components.one.protocol, register.starKey)
        assert.equal(register.star, components.one)
      })

      it('fails to set an alias for a non-existent component', () => {
        assert.throws(() => register.alias(components.three.protocol, alias))
      })
    })

    describe('.star', () => {
      it('grabs the star component', () => {
        assert.equal(register.star, components.one)
      })

      it('fails to grab non-existent star component', () => {
        const register = new Register(namespace)
        assert.throws(() => register.star)
      })
    })
  })
})

describe('initRegistry', () => {
  it('returns an empty registry', () => {
    const registry = initRegistry()
    assert.equal(registry.store.constructor, Register)
    assert.equal(registry.access.constructor, Register)
    assert.equal(registry.entry.constructor, Register)
    assert.equal(registry.identity.constructor, Register)
  })
})
