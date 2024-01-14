/**
 * version is used to update the Account name or signers
 */
export interface Account {
  name: string
  version: number
  root: Uint8Array
  signers: Uint8Array[]
  sig: Uint8Array
}
