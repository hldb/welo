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
  comprehensive?: boolean
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

        if (obj.comprehensive != null) {
          w.uint32(16)
          w.bool(obj.comprehensive)
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
            case 2:
              obj.comprehensive = reader.bool()
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

export interface RequestHeads {
  filter: Uint8Array
  hashes: number
  seed?: number
  hash?: Uint8Array
}

export namespace RequestHeads {
  let _codec: Codec<RequestHeads>

  export const codec = (): Codec<RequestHeads> => {
    if (_codec == null) {
      _codec = message<RequestHeads>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if ((obj.filter != null && obj.filter.byteLength > 0)) {
          w.uint32(10)
          w.bytes(obj.filter)
        }

        if ((obj.hashes != null && obj.hashes !== 0)) {
          w.uint32(16)
          w.uint32(obj.hashes)
        }

        if (obj.seed != null) {
          w.uint32(24)
          w.uint32(obj.seed)
        }

        if (obj.hash != null) {
          w.uint32(34)
          w.bytes(obj.hash)
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length) => {
        const obj: any = {
          filter: new Uint8Array(0),
          hashes: 0
        }

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            case 1:
              obj.filter = reader.bytes()
              break
            case 2:
              obj.hashes = reader.uint32()
              break
            case 3:
              obj.seed = reader.uint32()
              break
            case 4:
              obj.hash = reader.bytes()
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

  export const encode = (obj: Partial<RequestHeads>): Uint8Array => {
    return encodeMessage(obj, RequestHeads.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList): RequestHeads => {
    return decodeMessage(buf, RequestHeads.codec())
  }
}
