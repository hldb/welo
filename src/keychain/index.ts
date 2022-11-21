/**
 * this folder is just a copy of js-libp2p's keychain
 */

import { KeyChain, KeyChainInit, KeyChainComponents } from 'libp2p/keychain'

import type { StorageReturn } from '~storage/index.js'

export const defaultOptions = {
  // See https://cryptosense.com/parametesr-choice-for-pbkdf2/
  dek: {
    keyLength: 512 / 8,
    iterationCount: 10000,
    salt: 'you should override this value with a crypto secure random number',
    hash: 'sha2-512'
  }
}

class Keychain extends KeyChain {
  constructor (datastore: StorageReturn, options?: KeyChainInit) {
    const components: any = { getDatastore: () => datastore }
    super(components as Components, defaultOptions)
  }

  static async create (
    datastore: StorageReturn,
    options?: KeyChainInit
  ): Promise<Keychain> {
    // keychain unresponsive if datastore isnt open for initialization
    await datastore.open()
    const keychain = new Keychain(datastore, options)
    await datastore.close()

    return keychain
  }
}

export { Keychain }
