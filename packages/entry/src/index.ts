import type { EpochAccess } from '@welo/access'
import type { CID, ByteView } from 'multiformats'

export interface Entry<P = unknown> extends WithEpochs, WithSignature, WithData<P> {}
export interface Epoch<P = unknown> extends WithEpochs, WithSignature, WithData<P>, WithAccess {}

export interface WithEpochs {
  height: number
  epochs: CID[]
}

export interface WithSignature {
  author: Uint8Array
  sig: Uint8Array
}

export interface WithAccess {
  access: EpochAccess
}

export interface WithData<P = unknown> {
  data: ByteView<Data<P>>
}

export interface Data <P = unknown> {
  clock: number
  parents: CID[]
  payload: P
}
