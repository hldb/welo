import { CID } from 'multiformats'
import type { ByteView } from 'multiformats'
import type { Access } from '@welo/access'

export interface Entry<P extends any = unknown> extends WithEpochs, WithSignature, WithData<P> {}
export interface Epoch<P extends any = unknown> extends WithEpochs, WithSignature, WithData<P>, WithAccess {}

export interface WithEpochs {
  height: number
  epochs: CID[]
}

export interface WithSignature {
  author: Uint8Array
  sig: Uint8Array
}

export interface WithAccess {
  access: Access
}

export interface WithData<P extends any = unknown> {
  data: ByteView<Data<P>>
}

export interface Data <P extends any = unknown> {
  clock: number
  parents: CID[]
  payload: P
}
