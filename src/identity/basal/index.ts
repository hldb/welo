import { keys } from '@libp2p/crypto'
import type { PrivateKey, PublicKey } from '@libp2p/interface-keys'
import { Key } from 'interface-datastore'
import type { BlockView } from 'multiformats/interface'
import type { CID } from 'multiformats/cid'

import { Blocks } from '@/blocks/index.js'

import protocol from './protocol.js'
import type {
  IdentityInstance,
  IdentityModule,
  AsIdentity,
  Export,
  Fetch,
  Get,
  Import
} from '../interface.js'

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

export class Identity implements IdentityInstance<IdentityValue> {
  name?: string
  block: BlockView<IdentityValue>
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
    block: BlockView<IdentityValue>
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

  async sign (data: Uint8Array): Promise<Uint8Array> {
    return await sign(this, data)
  }

  async verify (data: Uint8Array, sig: Uint8Array): Promise<boolean> {
    return await verify(this, data, sig)
  }
}

const gen = async (name: string): Promise<Identity> => {
  const keypair = await keys.generateKeyPair(secp256k1, 256)
  const value = await signIdentity(keypair, keypair.public)
  const block = await Blocks.encode({ value })

  return new Identity({ name, priv: keypair, pubkey: keypair.public, block })
}

const get = async ({ name, identities, keychain }: Get): Promise<Identity> => {
  const key = new Key(name)
  const exists = await identities.has(key)

  if (!exists) {
    const identity = await gen(name)
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

const fetch = async ({ blocks, auth: cid }: Fetch): Promise<Identity> => {
  const block = await blocks.get<IdentityValue>(cid)

  const identity = asIdentity({ block })
  if (identity === null) {
    throw new Error('cid did not resolve to a valid identity')
  }

  return identity
}

const asIdentity = (identity: AsIdentity<unknown>): Identity | null => {
  if (identity instanceof Identity) {
    return identity
  }

  const block = identity?.block

  if (block.value == null || typeof block.value !== 'object') {
    return null
  }

  const asPartial = block as BlockView<Partial<IdentityValue>>

  if (asPartial.value.id == null || asPartial.value.pub == null || asPartial.value.sig == null) {
    return null
  }

  const asIdentity = block as BlockView<IdentityValue>

  let pubkey
  try {
    pubkey = keys.unmarshalPublicKey(asIdentity.value.pub)
  } catch (e) {
    console.error(e)
    return null
  }

  return new Identity({ pubkey, block: asIdentity })
}

const importFunc = async ({
  name,
  identities,
  keychain,
  kpi
}: Import): Promise<Identity> => {
  const persist = identities !== undefined && keychain !== undefined

  const block: BlockView<KpiValue> = await Blocks.decode({ bytes: kpi })

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

const exportFunc = async ({
  name,
  identities,
  keychain
}: Export): Promise<Uint8Array> => {
  const key = new Key(name)
  const exists = await identities.has(key)

  if (!exists) {
    throw new Error('no identity with that name exists; export failed')
  }

  const pem = await keychain.exportKey(name, empty)
  const bytes = await identities.get(key)

  const value = { pem, identity: bytes }
  const block: BlockView<KpiValue> = await Blocks.encode({ value })
  return block.bytes
}

const sign = async (
  identity: AsIdentity<unknown>,
  data: Uint8Array
): Promise<Uint8Array> => {
  const _identity = asIdentity(identity)

  if (_identity === null) {
    throw new Error('invalid identity used')
  }

  if (!privs.has(identity)) {
    throw new Error('private key required to sign data')
  }

  // libp2p's crypto keys signs the sha2-256 hash of the data
  return privs.get(identity).sign(data)
}

const verify = async (
  identity: AsIdentity<unknown>,
  data: Uint8Array,
  sig: Uint8Array
): Promise<boolean> => {
  const _identity = asIdentity(identity)

  if (_identity === null) {
    throw new Error('invalid identity used')
  }

  if (_identity.pubkey == null) {
    throw new Error('public key required to verify signed data')
  }

  return await _identity.pubkey.verify(data, sig)
}

export const createBasalIdentity: () => IdentityModule<Identity, typeof protocol> = () => ({
  protocol,
  gen,
  get,
  fetch,
  asIdentity,
  import: importFunc,
  export: exportFunc,
  verify,
  sign
})
