import { CID } from 'multiformats/cid'
import { base32 } from 'multiformats/bases/base32'

import { OPALSNT_PREFIX as prefix } from '~utils/constants.js'

const parse = function (address: Address | string): CID {
  address = address.toString()

  if (!address.startsWith(prefix)) {
    throw new Error(`'${prefix}' prefix missing from address: ${address}`)
  }

  try {
    return CID.parse(address.split('/')[2])
  } catch (e) {
    throw new Error(`failed to parse CID in address: ${address}`)
  }
}

/**
 * Manifest Address
 *
 * @remarks
 * May also be referred to as the database address.
 * It is a CID with a prefix that says it's an opalsnt manifest.
 *
 * @public
 */
export class Address {
  constructor (public readonly cid: CID) {}

  /**
   * Optimistically coerce values into an Address
   *
   * @remarks
   * Similar to `CID.asCID`.
   *
   * @param address - Anything you want to check is an Address
   * @returns
   */
  static asAddress (address?: any): Address | null {
    if (address instanceof Address) {
      return address
    }

    const cid = CID.asCID(address?.cid)
    if (cid != null) {
      return new Address(cid)
    } else {
      return null
    }
  }

  /**
   * Attempt to parse a string into an Address
   *
   * @param string
   * @returns
   */
  static fromString (string: string): Address {
    return new Address(parse(string))
  }

  /**
   * Converts the Address to a string
   *
   * @param base - the base encoding to use
   * @returns
   */
  toString (base = base32): string {
    return prefix + this.cid.toString(base)
  }

  // may add this later with prefix in multicodec
  // static fromBytes (bytes) {
  //   return new Address(CID.decode(bytes))
  // }
  //
  // toBytes () {
  //   return this.cid.bytes
  // }

  /**
   * Checks if two addresses are equal
   *
   * @remarks
   * Similar to `CID.equals`.
   *
   * @param address - another Address
   * @returns
   */
  equals (address: Address): boolean {
    if (address === this) {
      return true
    }

    return this.cid.equals(address?.cid)
  }
}
