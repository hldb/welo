// import { Key } from 'interface-datastore'
import { keys } from "libp2p-crypto";
import { Blocks } from "../../mods/blocks.js";

import { Key } from "interface-datastore";
import { Block, ByteView } from "multiformats/block.js";
import { PrivateKey, PublicKey } from "libp2p-crypto";
import { Keychain } from "src/keychain/index.js";
import { StorageReturn } from "src/mods/storage.js";
import { CID } from "multiformats/cid.js";

const type = "base";
const secp256k1 = "secp256k1";
const empty = "";

interface SignedIdentity {
  id: Uint8Array;
  pub: Uint8Array;
  sig: Uint8Array;
}

interface KpiValue {
  pem: string;
  identity: Uint8Array;
}

const signIdentity = async (keypair: PrivateKey, pub: PublicKey) => {
  const marshalled = keys.marshalPublicKey(pub);
  return {
    id: keys.marshalPublicKey(keypair.public),
    pub: marshalled,
    sig: await keypair.sign(marshalled),
  };
};

interface GetParams {
  name: string;
  identities: StorageReturn;
  keychain: Keychain;
}

interface ExportParams extends GetParams {
  password: string;
}

interface ImportParams extends ExportParams {
  kpi: Uint8Array;
}

// const instances = new WeakMap()
const privs = new WeakMap();

interface IdentityConfig {
  name?: string;
  priv?: PrivateKey;
  pubkey: PublicKey;
  block: Block<SignedIdentity>;
}

class Identity {
  name?: string;
  block: Block<SignedIdentity>;
  pubkey: PublicKey;

  readonly auth: CID;
  readonly id: Uint8Array;
  readonly pub: Uint8Array;
  readonly sig: Uint8Array;

  constructor({ name, priv, pubkey, block }: IdentityConfig) {
    this.name = name;
    this.block = block;
    this.pubkey = pubkey;

    this.auth = block.cid;
    this.id = block.value.id;
    this.pub = block.value.pub;
    this.sig = block.value.sig;

    if (priv) privs.set(this, priv);
  }

  static get type() {
    return type;
  }

  static async get({ name, identities, keychain }: GetParams) {
    const key = new Key(name);
    const exists = await identities.has(key);

    let keypair, block;
    if (!exists) {
      keypair = await keys.generateKeyPair(secp256k1, 256);

      const pem = await keypair.export(empty);
      await keychain.importKey(name, pem, empty);

      const value = await signIdentity(keypair, keypair.public);
      block = await Blocks.encode({ value });
      await identities.put(key, block.bytes);
    } else {
      const bytes = await identities.get(key);
      block = await Blocks.decode<SignedIdentity>({ bytes });
      const pem = await keychain.exportKey(name, empty);
      keypair = await keys.import(pem, empty);
    }

    return new Identity({ name, priv: keypair, pubkey: keypair.public, block });
  }

  static async fetch({ blocks, auth: cid }: { blocks: Blocks; auth: CID }) {
    const block = await blocks.get(cid);

    return this.asIdentity({ block });
  }

  static async asIdentity(
    identity: Identity | { block: Block<SignedIdentity> }
  ) {
    if (identity instanceof Identity) {
      return identity;
    }
    const { block } = identity;
    const pubkey = keys.unmarshalPublicKey(block.value.pub);

    return new Identity({ pubkey, block });
  }

  static async export({ name, identities, keychain, password }: ExportParams) {
    const key = new Key(name);
    const exists = await identities.has(key);

    if (!exists) {
      throw new Error("no identity with that name exists; export failed");
    }

    const pem = await keychain.exportKey(name, password);
    const bytes = await identities.get(key);

    const value = { pem, identity: bytes };
    const block: Block<KpiValue> = await Blocks.encode({ value });
    return block.bytes;
  }

  static async import({
    name,
    identities,
    keychain,
    kpi,
    password,
  }: ImportParams) {
    const persist = identities && keychain;

    const block: Block<KpiValue> = await Blocks.decode({ bytes: kpi });

    let pem: string, identity: Uint8Array;
    try {
      pem = block.value.pem;
      identity = block.value.identity;
    } catch (e) {
      throw new Error("Identity.import: failed to read kpi");
    }
    const keypair = await keys.import(pem, password);

    if (persist) {
      const key = new Key(name);
      const exists = await identities.has(key);
      if (exists) {
        throw new Error(
          "an identity with that name already exists; import failed"
        );
      }

      await keychain.importKey(name, pem, password);
      await identities.put(key, identity);
    }

    const identityBlock = await Blocks.decode<SignedIdentity>({
      bytes: identity,
    });

    return new Identity({
      name,
      priv: keypair,
      pubkey: keypair.public,
      block: identityBlock,
    });
  }

  static async sign({
    identity,
    data,
  }: {
    identity: Identity;
    data: Uint8Array;
  }) {
    if (!privs.has(identity)) {
      throw new Error("private key required to sign data");
    }

    // libp2p's crypto keys signs the sha2-256 hash of the data
    return privs.get(identity).sign(data);
  }

  static async verify({
    identity,
    data,
    sig,
  }: {
    identity: Identity;
    data: Uint8Array;
    sig: Uint8Array;
  }) {
    if (!identity.pubkey) {
      throw new Error("public key required to verify signed data");
    }

    return identity.pubkey.verify(data, sig);
  }

  async sign(data: Uint8Array) {
    return Identity.sign({ identity: this, data });
  }

  async verify(data: Uint8Array, sig: Uint8Array) {
    return Identity.verify({ identity: this, data, sig });
  }
}

export { Identity };
