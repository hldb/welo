import { keys } from '@libp2p/crypto'
import type { PrivateKey, PublicKey } from '@libp2p/interface-keys'
import { Key } from 'interface-datastore'

import { Blocks } from '../../blocks/index.js'
import { Block } from 'multiformats/block.js'
import { CID } from 'multiformats/cid.js'
import {
  IdentityInstance,
  IdentityStatic,
  AsIdentity,
  Export,
  Fetch,
  Get,
  Import
} from '../interface.js'
import { Extends } from '../../utils/decorators.js'
import protocol from './protocol.js'

const secp256k1 = 'secp256k1'
const empty = ''

interface IdentityValue {
  id: Uint8Array
  pub: Uint8Array
  sig: Uint8Array
}

interface KpiValue {
  pem: string
  identity: Uint8Array
}

const signIdentity = async (
  keypair: PrivateKey,
  pub: PublicKey
): Promise<IdentityValue> => {
  const marshalled = keys.marshalPublicKey(pub)
  const signedIdentity: IdentityValue = {
    id: keys.marshalPublicKey(keypair.public),
    pub: marshalled,
    sig: await keypair.sign(marshalled)
  }

  return signedIdentity
}

const privs = new WeakMap()

@Extends<IdentityStatic<IdentityValue>>()
class Identity implements IdentityInstance<IdentityValue> {
  name?: string
  block: Block<IdentityValue>
  pubkey: PublicKey

  readonly auth: CID
  readonly id: Uint8Array
  readonly pub: Uint8Array
  readonly sig: Uint8Array

  constructor ({
    name,
    priv,
    pubkey,
    block
  }: {
    name?: string
    priv?: PrivateKey
    pubkey: PublicKey
    block: Block<IdentityValue>
  }) {
    this.name = name
    this.block = block
    this.pubkey = pubkey

    this.auth = block.cid
    this.id = block.value.id
    this.pub = block.value.pub
    this.sig = block.value.sig

    if (priv != null) privs.set(this, priv)
  }

  static get protocol (): string {
    return protocol
  }

  static async gen (name: string): Promise<Identity> {
    const keypair = await keys.generateKeyPair(secp256k1, 256)
    const value = await signIdentity(keypair, keypair.public)
    const block = await Blocks.encode({ value })

    return new Identity({ name, priv: keypair, pubkey: keypair.public, block })
  }

  static async get ({ name, identities, keychain }: Get): Promise<Identity> {
    const key = new Key(name)
    const exists = await identities.has(key)

    if (!exists) {
      const identity = await this.gen(name)
      const keypair = privs.get(identity)
      const block = identity.block

      const pem = await keypair.export(empty)
      await keychain.importKey(name, pem, empty)
      await identities.put(key, block.bytes)

      return identity
    } else {
      const bytes = await identities.get(key)
      const block = await Blocks.decode<IdentityValue>({ bytes })
      const pem = await keychain.exportKey(name, empty)
      const keypair = await keys.importKey(pem, empty)

      return new Identity({
        name,
        priv: keypair,
        pubkey: keypair.public,
        block
      })
    }
  }

  static async fetch ({ blocks, auth: cid }: Fetch): Promise<Identity> {
    const block = await blocks.get(cid)

    const identity = await this.asIdentity({ block })
    if (identity === null) {
      throw new Error('cid did not resolve to a valid identity')
    }

    return identity
  }

  static asIdentity (identity: AsIdentity<IdentityValue>): Identity | null {
    if (identity instanceof Identity) {
      return identity
    }

    let block, pubkey
    try {
      block = identity?.block
      pubkey = keys.unmarshalPublicKey(block.value.pub)
    } catch (e) {
      console.error(e)
      return null
    }

    return new Identity({ pubkey, block })
  }

  static async import ({
    name,
    identities,
    keychain,
    kpi
  }: Import): Promise<Identity> {
    const persist = identities !== undefined && keychain !== undefined

    const block: Block<KpiValue> = await Blocks.decode({ bytes: kpi })

    let pem: string, identity: Uint8Array
    try {
      pem = String(block.value.pem)
      identity = new Uint8Array(block.value.identity)
    } catch (e) {
      throw new Error('Identity.import: failed to read kpi')
    }
    const keypair = await keys.importKey(pem, empty)

    if (persist) {
      const key = new Key(name)
      const exists = await identities.has(key)
      if (exists) {
        throw new Error(
          'an identity with that name already exists; import failed'
        )
      }

      await keychain.importKey(name, pem, empty)
      await identities.put(key, identity)
    }

    const identityBlock = await Blocks.decode<IdentityValue>({
      bytes: identity
    })

    return new Identity({
      name,
      priv: keypair,
      pubkey: keypair.public,
      block: identityBlock
    })
  }

  static async export ({
    name,
    identities,
    keychain
  }: Export): Promise<Uint8Array> {
    const key = new Key(name)
    const exists = await identities.has(key)

    if (!exists) {
      throw new Error('no identity with that name exists; export failed')
    }

    const pem = await keychain.exportKey(name, empty)
    const bytes = await identities.get(key)

    const value = { pem, identity: bytes }
    const block: Block<KpiValue> = await Blocks.encode({ value })
    return block.bytes
  }

  static async sign (
    identity: IdentityInstance<IdentityValue>,
    data: Uint8Array
  ): Promise<Uint8Array> {
    const _identity = this.asIdentity(identity)

    if (_identity === null) {
      throw new Error('invalid identity used')
    }

    if (!privs.has(identity)) {
      throw new Error('private key required to sign data')
    }

    // libp2p's crypto keys signs the sha2-256 hash of the data
    return privs.get(identity).sign(data)
  }

  static async verify (
    identity: IdentityInstance<IdentityValue>,
    data: Uint8Array,
    sig: Uint8Array
  ): Promise<boolean> {
    const _identity = this.asIdentity(identity)
    if (_identity === null) {
      throw new Error('invalid identity used')
    }

    if (_identity.pubkey == null) {
      throw new Error('public key required to verify signed data')
    }

    return await _identity.pubkey.verify(data, sig)
  }

  async sign (data: Uint8Array): Promise<Uint8Array> {
    return await Identity.sign(this, data)
  }

  async verify (data: Uint8Array, sig: Uint8Array): Promise<boolean> {
    return await Identity.verify(this, data, sig)
  }
}

export { Identity }
