
import * as factories from './factories.js'
import * as options from './options.js'
import * as constants from './constants.js'

import { Manifest } from '../../src/manifest/index.js'
import { Entry } from '../../src/manifest/entry/index.js'
import { sortEntriesRev } from '../../src/database/traversal.js'

import { Identity } from '../../src/manifest/identity/index.js'
import { Keychain } from '../../src/keychain/index.js'
import { Storage } from '../../src/util.js'

const { temp, identitiesPath, keychainPath } = constants

export const ipfs = {
  factory: factories.IPFS,
  options: options.ipfs
}

export const getStorage = async (path, name = String(Math.random())) => {
  const s = {
    identities: await Storage(path + identitiesPath + '/' + name),
    keychain: await Storage(path + keychainPath + '/' + name)
  }
  await s.identities.open()
  await s.keychain.open()

  const close = () => Promise.all(Object.values(s).map(s => s.close()))
  return { ...s, close }
}

export const getIdentity = async (path, name) => {
  path = path || temp.path
  name = name || String(Math.random())

  const s = await getStorage(path, name)
  const identities = s.identities
  const keychain = new Keychain({ getDatastore: () => s.keychain })

  return {
    identity: await Identity.get({ name, identities, keychain }),
    storage: s,
    keychain
  }
}

export const getIpfs = (path, opts) => {
  path = path || temp.ipfs
  opts = opts || options.ipfs.offline

  return factories.IPFS.create(opts(path))
}

export const manifestData = {
  tag: new Uint8Array(),
  name: '',
  store: {},
  access: {},
  entry: {},
  identity: {}
}

export const writeManifest = (overwrite = {}) => Manifest.create({ ...manifestData, ...overwrite })

export const entryData = {
  tag: new Uint8Array(),
  payload: {},
  next: [],
  refs: []
}

export const singleEntry = identity => (nextEntries = []) =>
  Entry.create({ ...entryData, identity, next: nextEntries.map(entry => entry.cid) })

export const concurrentEntries = identities => nextEntriesA => {
  const entries = []
  for (const identity of identities) {
    const nextEntries = nextEntriesA[entries.length]
    entries.push(singleEntry(identity)(nextEntries))
  }
  return Promise.all(entries).then(entries => entries.sort(sortEntriesRev))
}

export { factories, constants, options }
