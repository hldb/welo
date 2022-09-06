import { CID } from "multiformats/cid";
import { base32 } from "multiformats/bases/base32";
import { OPAL_PREFIX } from "../constants.js";

const prefix = OPAL_PREFIX;

const parse = function (address: Address | string) {
  address = address.toString();

  if (!address.startsWith(prefix)) {
    throw new Error(`'${prefix}' prefix missing from address: ${address}`);
  }

  try {
    return CID.parse(address.split("/")[2]);
  } catch (e) {
    throw new Error(`failed to parse CID in address: ${address}`);
  }
};

export class Address {
  constructor(public readonly cid: CID) {}

  static get prefix() {
    return prefix;
  }

  static asAddress(address?: any) {
    if (address instanceof Address) {
      return address;
    }

    const cid = CID.asCID(address?.cid);
    if (cid) {
      return new Address(cid);
    } else {
      return null;
    }
  }

  static fromString(string: string) {
    return new Address(parse(string));
  }

  toString(base = base32) {
    return prefix + this.cid.toString(base);
  }

  // static fromBytes (bytes) {
  //   return new Address(CID.decode(bytes))
  // }
  //
  // toBytes () {
  //   return this.cid.bytes
  // }

  equals(address: Address) {
    if (address === this) {
      return true;
    }

    if (address == null) {
      throw new Error("Address.equals: invalid address parameter");
    }

    return this.cid.equals(address.cid);
  }
}
