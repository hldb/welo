
/**
 * the goal is to register components in src/index.js or have the user do it
 * that file would be where the dependencies are injected
 * a user going straight to src/orbitdb.js could choose what dependencies to inject
 *
 * namespaces are used for prefixing the types of components
 * so an entry isnt registered as an identity
 *
 */

const $tar = Symbol.for('*')

export const errors = {
  namespaceMismatch: (namespace, type) => new Error(`component type '${type}' exists outside of namespace '${namespace}'`),
  typeRegistered: (type) => new Error(`a component with type '${type}' is already registered`),
  typeNotRegistered: (type) => new Error(`no component with type '${type}' is registered`),
  aliasRegistered: (alias) => new Error(`a component already exists at type alias '${alias}'`),

  noComponentsRegistered: () => new Error('no components are registered, unable to retrieve starred component')
}

class Register {
  constructor (namespace) {
    // will bring this back better using interface-datastore Key .parent and .name
    // this.namespace = namespace
    this.registered = {}
  }

  get starKey () { return $tar }

  add (component, star = !Object.keys(this.registered).length) {
    // if (!component.type.startsWith(this.namespace)) {
    //   throw errors.namespaceMismatch(this.namespace, component.type)
    // }

    if (this.registered[component.type]) {
      throw errors.typeRegistered(component.type)
    }

    if (star) {
      this.registered[$tar] = component
    }

    this.registered[component.type] = component
  }

  get (type) {
    if (!this.registered[type]) {
      throw errors.typeNotRegistered(type)
    }

    return this.registered[type]
  }

  alias (type, alias) {
    if (!this.registered[type]) {
      throw errors.typeNotRegistered(type)
    }

    this.registered[alias] = this.registered[type]
  }

  // the favorite/default component
  get star () {
    if (!this.registered[$tar]) {
      throw new Error('no star component')
    }

    return this.registered[$tar]
  }
}

export { Register }
