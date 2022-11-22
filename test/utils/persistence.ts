import { LevelStorage, StorageReturn } from '~storage/index.js'

import { TestPaths } from './constants.js'

export interface TestStorage {
  identities: StorageReturn
  keychain: StorageReturn
  open: () => Promise<[any, any]>
  close: () => Promise<[any, any]>
}

export const getTestStorage = async (testPaths: TestPaths): Promise<TestStorage> => {
  const identities = await LevelStorage(testPaths.identities)
  const keychain = await LevelStorage(testPaths.keychain)

  const open = async (): Promise<[any, any]> =>
    await Promise.all([identities.open(), keychain.open()])

  const close = async (): Promise<[any, any]> =>
    await Promise.all([identities.close(), keychain.close()])

  return { identities, keychain, open, close }
}
