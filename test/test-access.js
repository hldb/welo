
import { strict as assert } from 'assert'
import { base32 } from 'multiformats/bases/base32'

import { Manifest } from '../src/manifest/index.js'
import { Keyvalue } from '../src/manifest/store/keyvalue.js'
import { StaticAccess } from '../src/manifest/access/static.js'
import { Entry } from '../src/manifest/entry/index.js'
import { Identity } from '../src/manifest/identity/index.js'
import { Storage } from '../src/util.js'
import { KeyChain as Keychain } from '../src/keychain/index.js'
import { Register } from '../src/register.js'

const storage = {
  identities: new Storage('./test/fixtures/identities'),
  keychain: new Storage('./test/fixtures/keychain'),
  temp: {
    identities: new Storage('./test/temp/identities'),
    keychain: new Storage('./test/temp/keychain')
  }
}

const registry = Object.fromEntries([
  'store',
  'access',
  'entry',
  'identity'
].map(k => [k, new Register()]))
registry.store.add(Keyvalue)
registry.access.add(StaticAccess)
registry.entry.add(Entry)
registry.identity.add(Identity)

const config = write => ({
  name: 'test',
  store: {
    type: registry.store.star.type
  },
  access: {
    type: registry.access.star.type,
    write
  },
  entry: {
    type: registry.entry.star.type
  },
  identity: {
    type: registry.identity.star.type
  }
})

const entryData = {
  tag: new Uint8Array(),
  payload: {},
  next: [],
  refs: []
}

describe('Static Access', () => {
  let identity, manifest, access, entry
  let wildcardManifest, tempIdentity
  const Access = StaticAccess
  const expectedType = 'static'

  before(async () => {
    await storage.identities.open()
    await storage.keychain.open()
    await storage.temp.identities.open()
    await storage.temp.keychain.open()

    const identities = storage.identities
    const keychain = new Keychain({ getDatastore: () => storage.keychain })

    const name = 'default1'
    identity = await Identity.get({ name, identities, keychain })

    {
      const name = Math.random().toString()
      const identities = storage.temp.identities
      const keychain = new Keychain({ getDatastore: () => storage.temp.keychain })

      tempIdentity = await Identity.get({ name, identities, keychain })
    }

    const write = [identity.id]
    manifest = await Manifest.create(config(write))

    entry = await Entry.create({ identity, ...entryData })
  })

  after(async () => {
    await storage.identities.close()
    await storage.keychain.close()
    await storage.temp.identities.close()
    await storage.temp.keychain.close()
  })

  describe('Class', () => {
    it('exposes static properties', () => {
      assert.equal(Access.type, expectedType)
    })

    describe('.open', () => {
      it('returns an instance of Static Access', async () => {
        access = await Access.open({ manifest })
        assert.equal(access.manifest, manifest)
        assert.deepEqual(access.write, new Set([base32.encode(identity.id)]))
      })

      it('returns an instance with a wildcard write', async () => {
        const write = ['*']
        wildcardManifest = await Manifest.create(config(write))
        const _access = await Access.open({ manifest: wildcardManifest })
        assert.equal(_access.manifest, wildcardManifest)
        assert.deepEqual(_access.write, new Set(write))
      })

      it('rejects when write access is empty', async () => {
        const write = []
        const _manifest = await Manifest.create(config(write))
        assert.rejects(() => Access.open({ manifest: _manifest }))
      })
    })
  })

  describe('Instance', () => {
    it('exposes instance properties', () => {
      assert.equal(access.manifest, manifest)
      assert.deepEqual(access.write, new Set([base32.encode(identity.id)]))
    })

    describe('.canAppend', () => {
      it('returns true if identity has write access', async () => {
        const access = await Access.open({ manifest })
        assert.equal(await access.canAppend(entry), true)
      })

      it('returns true if wildcard has write access', async () => {
        const access = await Access.open({ manifest: wildcardManifest })
        assert.equal(await access.canAppend(entry), true)
      })

      it('returns false if identity has no write access', async () => {
        const access = await Access.open({ manifest })
        const tempEntry = await Entry.create({ identity: tempIdentity, ...entryData })
        assert.equal(await access.canAppend(tempEntry), false)
      })
    })
  })
})
