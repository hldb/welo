import * as factories from './factories.js'
import * as options from './options.js'
import * as constants from './constants.js'

import { Manifest } from '../../src/manifest/index.js'
import { Entry } from '../../src/manifest/entry/index.js'
import { sortEntriesRev } from '../../src/database/traversal.js'

import { Identity } from '../../src/manifest/identity/index.js'
import { Keychain } from '../../src/mods/keychain.js'
import { LevelStorage, StorageReturn } from '../../src/mods/storage.js'
import { base32 } from 'multiformats/bases/base32'

const { temp, ipfsPath, identitiesPath, keychainPath } = constants

export const ipfs = {
  factory: factories.IPFS,
  options: options.ipfs
}

export interface getStorageReturn {
  identities: StorageReturn
  keychain: StorageReturn
  close: () => Promise<void[]>
}

export const getStorage = async (
  path: string,
  name = String(Math.random())
): Promise<getStorageReturn> => {
  const identities = await LevelStorage(path + identitiesPath + '/' + name)
  const keychain = await LevelStorage(path + keychainPath + '/' + name)

  await Promise.all([identities.open(), keychain.open()])

  const close = () => Promise.all([identities.close(), keychain.close()])

  return { identities, keychain, close }
}

export const getIdentity = async (path?: string, name?: string) => {
  path = path || temp.path
  name = name || String(Math.random())

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

export const getIpfs = (path?: string, opts?: any) => {
  path = path || temp.path
  opts = opts || options.ipfs.offline

  return factories.IPFS.create(opts(path + ipfsPath))
}

export const manifestData = {
  tag: new Uint8Array(),
  name: '',
  store: {},
  access: {},
  entry: {},
  identity: {}
}

export const writeManifest = (overwrite = {}) =>
  Manifest.create({ ...manifestData, ...overwrite })

export const entryData = {
  tag: new Uint8Array(),
  payload: {},
  next: [],
  refs: []
}

export const singleEntry =
  (identity: Identity) =>
  (nextEntries: Entry[] = []) =>
    Entry.create({
      ...entryData,
      identity,
      next: nextEntries.map((entry) => entry.cid)
    })

export const concurrentEntries =
  (identities: Identity[]) => async (nextEntriesA: Array<Entry[]>) => {
    const entries: Promise<Entry>[] = []
    for (const identity of identities) {
      const nextEntries: Entry[] = nextEntriesA[entries.length]
      entries.push(singleEntry(identity)(nextEntries))
    }
    return Promise.all(entries).then((entries) => entries.sort(sortEntriesRev))
  }

export { factories, constants, options }
