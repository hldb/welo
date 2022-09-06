/**
 * this folder is just a copy of js-libp2p's keychain
 */

import { KeyChain } from "libp2p/keychain";
import { Components } from "@libp2p/interfaces/components";
import type { StorageReturn } from "src/mods/storage";

export const defaultOptions = {
  // See https://cryptosense.com/parametesr-choice-for-pbkdf2/
  dek: {
    keyLength: 512 / 8,
    iterationCount: 10000,
    salt: "you should override this value with a crypto secure random number",
    hash: "sha2-512",
  },
};

class Keychain extends KeyChain {
  constructor(private datastore: StorageReturn) {
    const components: any = { getDatastore: () => datastore };
    super(components as Components, defaultOptions);
  }
}

export { Keychain };
