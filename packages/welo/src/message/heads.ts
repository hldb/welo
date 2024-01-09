/* eslint-disable import/export */
/* eslint-disable complexity */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-unnecessary-boolean-literal-compare */
/* eslint-disable @typescript-eslint/no-empty-interface */

import { encodeMessage, decodeMessage, message } from 'protons-runtime'
import type { Codec } from 'protons-runtime'
import type { Uint8ArrayList } from 'uint8arraylist'

export interface Message {
  heads: Uint8Array[]
  filter?: Message.Filter
  hash?: Uint8Array
  match?: boolean
}

export namespace Message {
  export interface Filter {
    data: Uint8Array
    hashes: number
    seed?: number
  }

  export namespace Filter {
    let _codec: Codec<Filter>

    export const codec = (): Codec<Filter> => {
      if (_codec == null) {
        _codec = message<Filter>((obj, w, opts = {}) => {
          if (opts.lengthDelimited !== false) {
            w.fork()
          }

          if ((obj.data != null && obj.data.byteLength > 0)) {
            w.uint32(10)
            w.bytes(obj.data)
          }

          if ((obj.hashes != null && obj.hashes !== 0)) {
            w.uint32(16)
            w.uint32(obj.hashes)
          }

          if (obj.seed != null) {
            w.uint32(24)
            w.uint32(obj.seed)
          }

          if (opts.lengthDelimited !== false) {
            w.ldelim()
          }
        }, (reader, length) => {
          const obj: any = {
            data: new Uint8Array(0),
            hashes: 0
          }

          const end = length == null ? reader.len : reader.pos + length

          while (reader.pos < end) {
            const tag = reader.uint32()

            switch (tag >>> 3) {
              case 1:
                obj.data = reader.bytes()
                break
              case 2:
                obj.hashes = reader.uint32()
                break
              case 3:
                obj.seed = reader.uint32()
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

    export const encode = (obj: Partial<Filter>): Uint8Array => {
      return encodeMessage(obj, Filter.codec())
    }

    export const decode = (buf: Uint8Array | Uint8ArrayList): Filter => {
      return decodeMessage(buf, Filter.codec())
    }
  }

  let _codec: Codec<Message>

  export const codec = (): Codec<Message> => {
    if (_codec == null) {
      _codec = message<Message>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if (obj.heads != null) {
          for (const value of obj.heads) {
            w.uint32(10)
            w.bytes(value)
          }
        }

        if (obj.filter != null) {
          w.uint32(18)
          Message.Filter.codec().encode(obj.filter, w)
        }

        if (obj.hash != null) {
          w.uint32(26)
          w.bytes(obj.hash)
        }

        if (obj.match != null) {
          w.uint32(32)
          w.bool(obj.match)
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length) => {
        const obj: any = {
          heads: []
        }

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            case 1:
              obj.heads.push(reader.bytes())
              break
            case 2:
              obj.filter = Message.Filter.codec().decode(reader, reader.uint32())
              break
            case 3:
              obj.hash = reader.bytes()
              break
            case 4:
              obj.match = reader.bool()
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

  export const encode = (obj: Partial<Message>): Uint8Array => {
    return encodeMessage(obj, Message.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList): Message => {
    return decodeMessage(buf, Message.codec())
  }
}
