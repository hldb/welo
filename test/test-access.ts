import { start } from '@libp2p/interfaces/startable'
import { assert, expect } from 'aegir/chai'
import { base32 } from 'multiformats/bases/base32'
import { getTestPaths, tempPath } from './utils/constants.js'
import defaultManifest from './utils/default-manifest.js'
import { singleEntry } from './utils/entries.js'
import { getTestIdentities, getTestIdentity } from './utils/identities.js'
import { getTestIpfs, offlineIpfsOptions } from './utils/ipfs.js'
import { getTestLibp2p } from './utils/libp2p.js'
import type { Entry } from '@/entry/basal/index.js'
import type { Identity } from '@/identity/basal/index.js'
import { wildcard } from '@/access/interface.js'
import { staticAccess } from '@/access/static/index.js'
import protocol, { type AccessProtocol } from '@/access/static/protocol.js'
import { Manifest } from '@/manifest/index.js'

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

    const ipfs = await getTestIpfs(testPaths, offlineIpfsOptions)
    const libp2p = await getTestLibp2p(ipfs)
    const identities = await getTestIdentities(testPaths)

    identity = await getTestIdentity(identities, libp2p.services.keychain, name)
    entry = await singleEntry(identity)()
    yesaccess = makeaccess([identity.id])

    await ipfs.stop()
  })

  describe('Class', () => {
    it('exposes static properties', () => {
      assert.strictEqual(Access.protocol, protocol)
      assert.strictEqual(Access.protocol, '/hldb/access/static')
    })

    describe('.open', () => {
      it('returns an instance of Static Access', async () => {
        const manifest = await Manifest.create({
          ...defaultManifest(name, identity),
          access: yesaccess
        })
        const access = Access.create({ manifest })
        await start(access)
        assert.strictEqual(access.manifest, manifest)
        assert.deepEqual(access.write, new Set([base32.encode(identity.id)]))
      })

      it('returns an instance with a wildcard write', async () => {
        const manifest = await Manifest.create({
          ...defaultManifest(name, identity),
          access: anyaccess
        })
        const access = Access.create({ manifest })
        await start(access)
        assert.strictEqual(access.manifest, manifest)
        assert.deepEqual(access.write, new Set(anyaccess.config?.write))
      })

      it('rejects when write access is empty', async () => {
        const manifest = await Manifest.create({
          ...defaultManifest(name, identity),
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
        ...defaultManifest(name, identity),
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
          ...defaultManifest(name, identity),
          access: yesaccess
        })
        const access = Access.create({ manifest })
        await start(access)
        assert.strictEqual(await access.canAppend(entry), true)
      })

      it('returns true if wildcard has write access', async () => {
        const manifest = await Manifest.create({
          ...defaultManifest(name, identity),
          access: anyaccess
        })
        const access = Access.create({ manifest })
        await start(access)
        assert.strictEqual(await access.canAppend(entry), true)
      })

      it('returns false if identity has no write access', async () => {
        const manifest = await Manifest.create({
          ...defaultManifest(name, identity),
          access: noaccess
        })
        const access = Access.create({ manifest })
        await start(access)
        assert.strictEqual(await access.canAppend(entry), false)
      })
    })
  })
})
