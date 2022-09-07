/**
 * the goal is to register components in src/index.js or have the user do it
 * that file would be where the dependencies are injected
 * a user going straight to src/orbitdb.js could choose what dependencies to inject
 *
 * namespaces are used for prefixing the types of components
 * so an entry isnt registered as an identity
 *
 */
import { OPAL_LOWER } from './constants'
import { StaticAccess } from './manifest/access/static'
import { Entry } from './manifest/entry'
import { Identity } from './manifest/identity'
import { Keyvalue } from './manifest/store/keyvalue'
// import { Component } from "./manifest/component.js";

const $tar = Symbol.for('*')

export const errors = {
  namespaceMismatch: (namespace: string, type: string) =>
    new Error(
      `component type '${type}' exists outside of namespace '${namespace}'`
    ),
  typeRegistered: (type: string) =>
    new Error(`a component with type '${type}' is already registered`),
  typeNotRegistered: (type: string) =>
    new Error(`no component with type '${type}' is registered`),
  aliasRegistered: (alias: string) =>
    new Error(`a component already exists at type alias '${alias}'`),

  noComponentsRegistered: () =>
    new Error(
      'no components are registered, unable to retrieve starred component'
    )
}

// hack for now
interface Registered {
  [type: string]: any
  [$tar]?: any
}

export class Register {
  registered: Registered
  readonly starKey: typeof $tar

  constructor(public namespace?: string) {
    // will bring this back better using interface-datastore Key .parent and .name
    // this.namespace = namespace
    this.registered = {}
    this.starKey = $tar
  }

  add(component: any, star = !Object.keys(this.registered).length) {
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

  get(type: string) {
    if (!this.registered[type]) {
      throw errors.typeNotRegistered(type)
    }

    return this.registered[type]
  }

  alias(type: string, alias: string | typeof $tar) {
    if (!this.registered[type]) {
      throw errors.typeNotRegistered(type)
    }

    this.registered[alias] = this.registered[type]
  }

  // the favorite/default component
  get star() {
    if (!this.registered[$tar]) {
      throw new Error('no star component')
    }

    return this.registered[$tar]
  }
}

export interface RegistryObj {
  [key: string]: Register
}

export const initRegistry = (): RegistryObj => ({
  store: new Register(),
  access: new Register(),
  entry: new Register(),
  identity: new Register()
})
