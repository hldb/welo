import { StaticAccess } from 'src/manifest/access/static'

export interface AccessOptions {
  type: typeof StaticAccess.type
  write: Array<string | Uint8Array>
}
