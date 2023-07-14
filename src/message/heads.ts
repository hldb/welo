/* eslint-disable import/export */
/* eslint-disable complexity */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-unnecessary-boolean-literal-compare */
/* eslint-disable @typescript-eslint/no-empty-interface */

import { encodeMessage, decodeMessage, message } from 'protons-runtime'
import type { Codec } from 'protons-runtime'
import type { Uint8ArrayList } from 'uint8arraylist'

export interface Heads {
  cids: Uint8Array[]
}

export namespace Heads {
  let _codec: Codec<Heads>

  export const codec = (): Codec<Heads> => {
    if (_codec == null) {
      _codec = message<Heads>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if (obj.cids != null) {
          for (const value of obj.cids) {
            w.uint32(10)
            w.bytes(value)
          }
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length) => {
        const obj: any = {
          cids: []
        }

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            case 1:
              obj.cids.push(reader.bytes())
              break
            default:
              reader.skipType(tag & 7)
              break
          }
        }

        return obj
      })
    }

    return _codec
  }

  export const encode = (obj: Partial<Heads>): Uint8Array => {
    return encodeMessage(obj, Heads.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList): Heads => {
    return decodeMessage(buf, Heads.codec())
  }
}
