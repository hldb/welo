
import * as Block from 'multiformats/block'
import * as codec from '@ipld/dag-cbor'
import { sha256 as hasher } from 'multiformats/hashes/sha2'

import { Address } from './address.js'
// import * as v0 from './v0'
// import * as v1 from './v1'
// const versions = [v0, v1]

const readonly = { writable: false, configurable: false, enumerable: true }
const hidden = { writable: false, configurable: false, enumerable: false }

class Manifest {
  // unsafe; do not use constructor directly
  constructor (block) {
    this.block = block

    // assign defined manifest properties
    const manifest = this.block.value
    Object.keys(manifest).forEach(k => { this[k] = manifest[k] })
    Object.defineProperties(this, Object.assign(
      // hide this.block from enumeration
      { block: hidden },
      // expose tag property, overwritten if tag exists in manifest
      { tag: { get: () => this.block.cid.multihash.digest } },
      // make manifest properties readonly
      Object.fromEntries(
        Object.keys(manifest).map(k => [k, readonly])
      )
    ))
  }

  static async create ({ name, store, access, entry, identity, meta, tag }) {
    if (typeof name !== 'string') throw new Error('name must be a string')

    // changes later
    // add back version later
    const value = { name, store, access, entry, identity }

    if (meta) value.meta = meta
    if (tag) value.tag = tag

    const block = await Block.encode({ value, codec, hasher })
    return new Manifest(block)
  }

  static async fetch ({ blocks, address }) {
    const bytes = await blocks.get(address.cid)
    const block = await Block.decode({ bytes, codec, hasher })
    return this.asManifest({ block }, true)
  }

  static async asManifest (manifest, force = false) {
    if (manifest instanceof Manifest) {
      return manifest
    }

    try {
      const { block } = manifest
      // todo: schema validation
      return new Manifest(block)
    } catch (e) {
      if (force) {
        throw new Error(`unable to coerce to manifest from: ${JSON.stringify(manifest)}`)
      }
      // todo: handle other errors differently

      return null
    }
  }

  static getComponents (registry, manifest) {
    return {
      Store: registry.store.get(manifest.store.type),
      Access: registry.access.get(manifest.access.type),
      Entry: registry.entry.get(manifest.entry.type),
      Identity: registry.identity.get(manifest.identity.type)
    }
  }

  get address () {
    return new Address(this.block.cid)
  }

  // for future backward compatibility
  // get pathkey () {
  //   let pathkey = this.address.toString()

  //   if (!this.version) {
  //     pathkey = pathkey + `/${this.name}`
  //   }

  //   return pathkey
  // }
}

export { Manifest, Address }
