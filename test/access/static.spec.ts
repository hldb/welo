import { assert, expect } from 'aegir/chai'
import { base32 } from 'multiformats/bases/base32'
import { start } from '@libp2p/interface/startable'

import type { Entry } from '@/entry/basal/index.js'
import type { Identity } from '@/identity/basal/index.js'
import { Manifest } from '@/manifest/index.js'
import { staticAccess } from '@/access/static/index.js'
import protocol, { AccessProtocol } from '@/access/static/protocol.js'
import { wildcard } from '@/access/interface.js'

import { getDefaultManifest } from '../test-utils/manifest.js'
import { singleEntry } from '../test-utils/entries.js'
import { getTestPaths, tempPath } from '../test-utils/constants.js'
import { getTestIdentities, getTestIdentity } from '../test-utils/identities.js'
import { getTestKeyChain } from 'test/test-utils/keychain.js'

const testName = 'static access'

describe(testName, () => {
  let identity: Identity, entry: Entry
  const Access = staticAccess()
  const name = 'name'

  const makeaccess = (write: Array<Uint8Array | string>): AccessProtocol => ({
    protocol: Access.protocol,
    config: { write }
  })

  let yesaccess: AccessProtocol
  const anyaccess: AccessProtocol = makeaccess([wildcard])
  const noaccess: AccessProtocol = makeaccess([new Uint8Array()])
  const emptyaccess: AccessProtocol = makeaccess([])

  before(async () => {
    const testPaths = getTestPaths(tempPath, testName)

    const identities = await getTestIdentities(testPaths)
    const keychain = getTestKeyChain()

    identity = await getTestIdentity(identities, keychain, name)
    entry = await singleEntry(identity)()
    yesaccess = makeaccess([identity.id])
  })

  describe('Class', () => {
    it('exposes static properties', () => {
      assert.strictEqual(Access.protocol, protocol)
      assert.strictEqual(Access.protocol, '/hldb/access/static')
    })

    describe('.open', () => {
      it('returns an instance of Static Access', async () => {
        const manifest = await Manifest.create({
          ...getDefaultManifest(name, identity),
          access: yesaccess
        })
        const access = Access.create({ manifest })
        await start(access)
        assert.strictEqual(access.manifest, manifest)
        assert.deepEqual(access.write, new Set([base32.encode(identity.id)]))
      })

      it('returns an instance with a wildcard write', async () => {
        const manifest = await Manifest.create({
          ...getDefaultManifest(name, identity),
          access: anyaccess
        })
        const access = Access.create({ manifest })
        await start(access)
        assert.strictEqual(access.manifest, manifest)
        assert.deepEqual(access.write, new Set(anyaccess.config?.write))
      })

      it('rejects when write access is empty', async () => {
        const manifest = await Manifest.create({
          ...getDefaultManifest(name, identity),
          access: emptyaccess
        })
        const access = Access.create({ manifest })
        await expect(access.start()).to.eventually.be.rejected()
      })
    })
  })

  describe('Instance', () => {
    it('exposes instance properties', async () => {
      const manifest = await Manifest.create({
        ...getDefaultManifest(name, identity),
        access: yesaccess
      })
      const access = Access.create({ manifest })
      await start(access)
      assert.strictEqual(access.manifest, manifest)
      assert.deepEqual(access.write, new Set([base32.encode(identity.id)]))
    })

    describe('.canAppend', () => {
      it('returns true if identity has write access', async () => {
        const manifest = await Manifest.create({
          ...getDefaultManifest(name, identity),
          access: yesaccess
        })
        const access = Access.create({ manifest })
        await start(access)
        assert.strictEqual(await access.canAppend(entry), true)
      })

      it('returns true if wildcard has write access', async () => {
        const manifest = await Manifest.create({
          ...getDefaultManifest(name, identity),
          access: anyaccess
        })
        const access = Access.create({ manifest })
        await start(access)
        assert.strictEqual(await access.canAppend(entry), true)
      })

      it('returns false if identity has no write access', async () => {
        const manifest = await Manifest.create({
          ...getDefaultManifest(name, identity),
          access: noaccess
        })
        const access = Access.create({ manifest })
        await start(access)
        assert.strictEqual(await access.canAppend(entry), false)
      })
    })
  })
})
