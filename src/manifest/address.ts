import { CID } from 'multiformats/cid'
import { base32 } from 'multiformats/bases/base32'
import { OPAL_PREFIX } from '../utils/constants'

const prefix: '/opal/' = `${OPAL_PREFIX}/`

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

export class Address {
  constructor (public readonly cid: CID) {}

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

  static fromString (string: string): Address {
    return new Address(parse(string))
  }

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

  equals (address: Address): boolean {
    if (address === this) {
      return true
    }

    return this.cid.equals(address?.cid)
  }
}
