import type { CID } from 'multiformats'
import type { Manifest } from '@welo/manifest'

export interface Oplog <T extends any = unknown, P extends any = unknown> {
  manifest: CID<Manifest<T>>
  epochs: CID // Prolly-tree
}
