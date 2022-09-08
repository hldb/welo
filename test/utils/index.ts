import * as factories from './factories.js'
import * as options from './options.js'
import * as constants from './constants.js'

import { Entry } from '../../src/manifest/entry/index.js'
import { sortEntriesRev } from '../../src/database/traversal.js'

import { Identity } from '../../src/manifest/identity/index.js'
import { Keychain } from '../../src/mods/keychain/index.js'
import { LevelStorage, StorageReturn } from '../../src/mods/storage.js'
import { base32 } from 'multiformats/bases/base32'
import { IPFS } from 'ipfs'

const { temp, ipfsPath, identitiesPath, keychainPath } = constants

export const ipfs = {
  factory: factories.IPFS,
  options: options.ipfs
}

export interface getStorageReturn {
  identities: StorageReturn
  keychain: StorageReturn
  close: () => Promise<[any, any]>
}

export const getStorage = async (
  path: string,
  name = String(Math.random())
): Promise<getStorageReturn> => {
  const identities = await LevelStorage(path + identitiesPath + '/' + name)
  const keychain = await LevelStorage(path + keychainPath + '/' + name)

  await Promise.all([identities.open(), keychain.open()])

  const close = async (): Promise<[any, any]> =>
    await Promise.all([identities.close(), keychain.close()])

  return { identities, keychain, close }
}

export const getIdentity = async (
  path?: string,
  name?: string
): Promise<{
  identity: Identity
  storage: getStorageReturn
  keychain: Keychain
}> => {
  path = path != null ? path : temp.path
  name = name != null ? name : String(Math.random())

  const storage = await getStorage(path, name)
  const identities = storage.identities
  const keychain = new Keychain(storage.keychain)

  return {
    identity: await Identity.get({ name, identities, keychain }),
    storage,
    keychain
  }
}

export const kpi = base32.decode(
  'bujrxazlnpbwg2tklmzzgentqjj2vk3zziuyhqz3sgvde6zblpjtxezzsjfzha5rqpfrxq2tzlfqs63btjrxuiwdcjjlve6ktnf3veqzujeztknbtpjcxo5rynnuviulsjvwfcmlqnizgg3cyhbbdc4rxhblfsudnjvshel2wpjdwqtdxizufkqknnbuwizlooruxi6kyukrwe2lelasqqaqseebd2dcxup53qcflrr74f6ov4sulbeqtr7gebgvly7yjp4cpqcb62o3dob2wewbfbabbeiichugfpi73xaekxdd7yl45lzfiwcjbhd6micnkxr7qs7ye7aed5u5wg43jm5memmceaiqbxmbfxub7wpfe7o4kedmlpyvgxacrbk4sizxhqa57g6r6r4xk4kicebxx2krffxna23pegemozn6abevp4yezrcejs7a6ag4nw6auub3m6'
)

export const getIpfs = async (path?: string, opts?: any): Promise<IPFS> => {
  path = path != null ? path : temp.path
  opts = opts != null ? opts : options.ipfs.offline

  const ipfs: IPFS = await factories.IPFS.create(opts(path + ipfsPath))

  return ipfs
}

export const entryData = {
  tag: new Uint8Array(),
  payload: {},
  next: [],
  refs: []
}

export const singleEntry =
  (identity: Identity) =>
    async (nextEntries: Entry[] = []) =>
      await Entry.create({
        ...entryData,
        identity,
        next: nextEntries.map((entry) => entry.cid)
      })

export const concurrentEntries =
  (identities: Identity[]) => async (nextEntriesA: Entry[][]) => {
    const entries: Array<Promise<Entry>> = []
    for (const identity of identities) {
      const nextEntries: Entry[] = nextEntriesA[entries.length]
      entries.push(singleEntry(identity)(nextEntries))
    }
    return await Promise.all(entries).then((entries) =>
      entries.sort(sortEntriesRev)
    )
  }

export { factories, constants, options }
