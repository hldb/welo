
// import { Key } from 'interface-datastore'
import * as Block from 'multiformats/block'
import * as codec from '@ipld/dag-cbor'
import { sha256 as hasher } from 'multiformats/hashes/sha2'
import { keys } from 'libp2p-crypto'

const type = 'base'
const secp256k1 = 'secp256k1'
const empty = ''

const signIdentity = async (keypair, pub) => {
  const marshalled = await keys.marshalPublicKey(pub)
  return {
    id: await keys.marshalPublicKey(keypair.public),
    pub: marshalled,
    sig: await keypair.sign(marshalled)
  }
}

// const instances = new WeakMap()
const privs = new WeakMap()

class Identity {
  constructor ({ name, priv, pubkey, block }) {
    this.name = name
    this.block = block
    this.pubkey = pubkey

    if (priv) privs.set(this, priv)
  }

  static get type () { return type }

  static async get ({ name, identities, keychain }) {
    const exists = await identities.has(name)

    let keypair, block
    if (!exists) {
      keypair = await keys.generateKeyPair(secp256k1, 256)

      const pem = await keypair.export(empty)
      await keychain.importKey(name, pem, empty)

      const value = await signIdentity(keypair, keypair.public)
      block = await Block.encode({ value, codec, hasher })
      await identities.put(name, block.bytes)
    } else {
      const bytes = await identities.get(name)
      block = await Block.decode({ bytes, codec, hasher })
      const pem = await keychain.exportKey(name, empty)
      keypair = await keys.import(pem, empty)
    }

    return new Identity({ name, priv: keypair, pubkey: keypair.public, block })
  }

  static async fetch ({ blocks, auth: cid }) {
    const bytes = await blocks.get(cid)
    const block = await Block.decode({ bytes, codec, hasher })

    return this.asIdentity({ block })
  }

  static async asIdentity (identity) {
    if (identity instanceof Identity) {
      return identity
    }
    const { block } = identity
    const pubkey = await keys.unmarshalPublicKey(block.value.pub)

    return new Identity({ pubkey, block })
  }

  static async export ({ name, identities, keychain, password }) {
    const exists = await identities.has(name)

    if (!exists) {
      throw new Error('no identity with that name exists; export failed')
    }

    const pem = await keychain.exportKey(name, password)
    const bytes = await identities.get(name)

    const value = { pem, identity: bytes }
    const block = await Block.encode({ value, codec, hasher })
    return block.bytes
  }

  static async import ({ name, identities, keychain, kpi, password }) {
    const persist = identities && keychain

    const block = await Block.decode({ bytes: kpi, codec, hasher })
    const { value: { pem, identity } } = block
    const keypair = await keys.import(pem, password)

    if (persist) {
      const exists = await identities.has(name)
      if (exists) {
        throw new Error('an identity with that name already exists; import failed')
      }

      await keychain.importKey(name, pem, password)
      await identities.put(name, identity)
    }

    const identityBlock = await Block.decode({ bytes: identity, codec, hasher })

    return new Identity({ name, priv: keypair, pubkey: keypair.public, block: identityBlock })
  }

  static async sign ({ identity, data }) {
    if (!privs.has(identity)) {
      throw new Error('private key required to sign data')
    }

    // libp2p's crypto keys signs the sha2-256 hash of the data
    return privs.get(identity).sign(data)
  }

  static async verify ({ identity, data, sig }) {
    if (!identity.pubkey) {
      throw new Error('public key required to verify signed data')
    }

    return identity.pubkey.verify(data, sig)
  }

  async sign (data) {
    return this.constructor.sign({ identity: this, data })
  }

  async verify (data, sig) {
    return this.constructor.verify({ identity: this, data, sig })
  }

  get auth () { return this.block.cid }

  get id () { return this.block.value.id }

  get pub () { return this.block.value.pub }

  get sig () { return this.block.value.sig }
}

export { Identity }
