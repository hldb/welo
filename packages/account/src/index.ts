/**
 * version is used to update the Account name or signers
 */
export interface Account {
  name?: string
  root: Uint8Array
  version: number
  signers: Uint8Array[]
  sig: Uint8Array
}
