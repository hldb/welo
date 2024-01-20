import * as cbor from '@ipld/dag-cbor'
import * as ed from '@noble/ed25519'
import { sha256 } from '@noble/hashes/sha256'
import { equals, concat, compare } from 'uint8arrays'
import type { ByteView } from 'multiformats'

/**
 * HLDB Account
 *
 * Accounts are mutable/update-able device groups.
 * Any update made to an account results in a new version of the account.
 * The only part of an account that is immutable is the root.
 * The account root is an Ed25519 key used to sign updates.
 *
 * Concurrent updates to an account may have unintended, but not permanent or drastic, results on dependent HLDB protocols.
 */
export interface Account {
  /**
   * The root Ed25519 public key.
   * Used to sign the data field on the account.
   * Can be used by external routing systems to find the account.
   */
  root: Uint8Array

  /**
   * Account data encoded with DAG-CBOR
   */
  data: ByteView<AccountData>

  /**
   * The signature is created by the root fields corresponding private key.
   * The signature is created by signing '/hldb/account/1.0.0/' + account.data
   */
  sig: Uint8Array
}

/**
 * Account data, separated from the Account for easier use and verification with external routing systems.
 */
export interface AccountData {
  /**
   * The account name.
   */
  name?: string

  /**
   * The version of the account, used for tracking changes or updates.
   * Initial value for a new account must be 0. Incremented with any update to the account.
   */
  version: number

  /**
   * An array of Ed25519 public keys.
   * These may be the public keys of devices added to the account.
   */
  signers: Uint8Array[]
}

/**
 * When accounts are being routed by the root key using external systems,
 * it may be redundant to include it inside the account.
 */
export interface RoutedAccount extends Omit<Account, 'root'> {}

/**
 * Updates an account with new data.
 *
 * @param privateKey - The Ed25519 private key corresponding to the account's root key.
 * @param account - The current account object to be updated.
 * @param updates - The partial data object containing updates.
 * @returns A promise that resolves to the updated account object.
 * @throws If the provided private key does not match the account's root key.
 */
export async function update (
  privateKey: Uint8Array,
  account: Account,
  updates: Partial<AccountData>
): Promise<Account> {
  const accountData = cbor.decode(account.data)
  const updatedAccountData: AccountData = {
    ...accountData,
    ...updates,
    version: accountData.version + 1
  }

  const updatedAccount: Account = await signAccountData(
    privateKey,
    cbor.encode(updatedAccountData)
  )

  if (!equals(account.root, updatedAccount.root)) {
    throw new Error('given privateKey is not correspondent to account.root')
  }

  return updatedAccount
}

/**
 * Combines the HLDB account prefix with account data.
 *
 * @param data - The ByteView representation of AccountData.
 * @returns A Uint8Array of the combined HLDB account prefix and encoded account data.
 */
export const accountPrefixedData = (data: ByteView<AccountData>): Uint8Array =>
  concat([new TextEncoder().encode('/hldb/account/1.0.0'), data])

/**
 * Signs the account data with a given private key.
 *
 * @param privateKey - The Ed25519 private key used for signing.
 * @param data - The ByteView representation of AccountData to be signed.
 * @returns A promise that resolves to an Account object with the signed data.
 */
export async function signAccountData (
  privateKey: Uint8Array,
  data: ByteView<AccountData>
): Promise<Account> {
  return {
    root: await ed.getPublicKeyAsync(privateKey),
    data,
    sig: await ed.signAsync(accountPrefixedData(data), privateKey)
  }
}

/**
 * Verifies the signature of account data against a public key.
 *
 * @param publicKey - The Ed25519 public key corresponding to the private key used for signing.
 * @param data - The ByteView representation of AccountData to be verified.
 * @param sig - The Uint8Array representing the signature.
 * @returns A promise that resolves to a boolean indicating the validity of the signature.
 */
export async function verifyAccountData (
  publicKey: Uint8Array,
  data: ByteView<AccountData>,
  sig: Uint8Array
): Promise<boolean> {
  return ed.verifyAsync(sig, accountPrefixedData(data), publicKey)
}

/**
 * Initializes a new account with a given private key and optional name.
 *
 * @param privateKey - The Ed25519 private key used for creating the account.
 * @param signers - An array of Uint8Array representing the signers' public keys.
 * @param name - Optional name for the account.
 * @returns A promise that resolves to the newly created Account object.
 */
export async function init (
  privateKey: Uint8Array,
  signers: Uint8Array[],
  name?: string
): Promise<Account> {
  const accountData: AccountData = {
    version: 0,
    signers
  }

  if (name !== null) accountData.name = name

  return signAccountData(privateKey, cbor.encode(accountData))
}

/**
 * Returns the latest account from an array of different account versions.
 *
 * @param accounts - An array of Account representing different versions of the same account.
 * @returns
 */
export async function getLatestAccount (accounts: Account[]): Promise<Account> {
  let latest: Account = accounts[0]
  let latestData: AccountData = cbor.decode(latest.data)

  for (const account of accounts.slice(1)) {
    const accountData = cbor.decode(account.data)

    if (latestData.version > accountData.version) {
      continue
    }

    // eslint-disable-next-line no-warning-comments
    // todo: better tie breaker based on name and signers
    if (compare(sha256(latest.data), sha256(account.data)) > 0) {
      continue
    }

    latest = account
    latestData = accountData
  }

  if (latest == null) {
    throw new Error('no accounts given')
  }

  return latest
}
