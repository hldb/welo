import { CID } from 'multiformats'
import type { ByteView } from 'multiformats'
import type { Access } from '@welo/access'

export interface Entry<P extends any = unknown> extends WithEpochs, WithSignature, WithEntryData<P> {}
export interface Epoch<P extends any = unknown> extends WithEpochs, WithSignature, WithEpochData<P> {}

export interface WithEpochs {
  epochs: CID[]
}

export interface WithSignature {
  author: Uint8Array
  sig: Uint8Array
}

export interface WithEntryData<P extends any = unknown> {
  data: ByteView<EntryData<P>>
}

export interface WithEpochData<P extends any = unknown> {
  data: ByteView<EpochData<P>>
}

export interface Data <P extends any = unknown> {
  clock: number
  parents: CID[]
  payload: P
  access?: Access
}

export interface EntryData<P> extends Omit<Data<P>, 'access'> {}

export interface EpochData<P> extends Data<P> {
  access: Access
}

export function validate <E extends Entry>(entry: E): boolean {
  if (Array.isArray(entry.epochs) === false || entry.epochs.length < 1) {
    return false
  }

  for (const epoch of entry.epochs) {
    if (epoch instanceof CID === false) return false
  }

  if (entry.author instanceof Uint8Array === false || entry.author.length !== 32) {
    return false
  }

  if (entry.sig instanceof Uint8Array === false || entry.sig.length !== 32) {
    console.log(entry.sig.length)
    throw new Error('entry.sig.length')
  }

  if (entry.data instanceof Uint8Array === false) {
    return false
  }

  return true
}

export function validateData <D extends Data>(data: D): boolean {
  if (typeof data.clock !== 'number') {
    return false
  }

  if (Array.isArray(data.parents) === false) {
    return false
  }

  for (const parent of data.parents) {
    if (parent instanceof CID === false) return false
  }

  if (data.access != null) {
    // validateAccess(data.access as Access)
  }

  return true
}
