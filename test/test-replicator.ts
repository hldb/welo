import { assert } from './utils/chai.js'
import { start, stop } from '@libp2p/interfaces/startable'
import { LevelDatastore } from 'datastore-level'
import type { IPFS } from 'ipfs-core-types'
import type { Libp2p } from 'libp2p'

import { LiveReplicator as Replicator } from '~replicator/live/index.js'
import { Blocks } from '~blocks/index.js'
import { Replica } from '~replica/index.js'
import { StaticAccess as Access } from '~access/static/index.js'

import { getMultiaddr, getTestIpfs, localIpfsOptions } from './utils/ipfs.js'
import { getTestPaths, tempPath, TestPaths } from './utils/constants.js'
import { getTestManifest } from './utils/manifest.js'
import { getTestRegistry } from './utils/registry.js'
import { getTestIdentities, getTestIdentity } from './utils/identities.js'
import { Entry } from '~entry/basal/index.js'
import { Identity } from '~identity/basal/index.js'
import type { Multiaddr } from '@multiformats/multiaddr'

const testName = 'live-replicator'

describe(testName, () => {
  let ipfs1: IPFS,
    ipfs2: IPFS,
    libp2p1: Libp2p,
    libp2p2: Libp2p,
    addr1: Multiaddr,
    addr2: Multiaddr,
    replica1: Replica,
    replica2: Replica,
    replicator1: Replicator,
    replicator2: Replicator,
    testPaths1: TestPaths,
    testPaths2: TestPaths,
    access: Access

  before(async () => {
    testPaths1 = getTestPaths(tempPath, testName + '/1')
    testPaths2 = getTestPaths(tempPath, testName + '/2')

    ipfs1 = await getTestIpfs(testPaths1, localIpfsOptions)
    ipfs2 = await getTestIpfs(testPaths2, localIpfsOptions)
    // @ts-expect-error
    libp2p1 = ipfs1.libp2p as Libp2p
    // @ts-expect-error
    libp2p2 = ipfs2.libp2p as Libp2p

    addr1 = await getMultiaddr(ipfs1)
    addr2 = await getMultiaddr(ipfs2)

    const Datastore = LevelDatastore

    const blocks1 = new Blocks(ipfs1)
    const blocks2 = new Blocks(ipfs2)

    const identities1 = await getTestIdentities(testPaths1)
    const identities2 = await getTestIdentities(testPaths2)

    const identity1 = await getTestIdentity(
      identities1,
      libp2p1.keychain,
      testName
    )
    const identity2 = await getTestIdentity(
      identities2,
      libp2p2.keychain,
      testName
    )

    const registry = getTestRegistry()
    const write = [identity1.id, identity2.id]
    const accessConfig = {
      access: { protocol: Access.protocol, config: { write } }
    }
    const manifest = await getTestManifest(testName, registry, accessConfig)

    access = new Access({ manifest })
    await start(access)

    replica1 = new Replica({
      manifest,
      directory: testPaths1.replica,
      Datastore,
      blocks: blocks1,
      access,
      identity: identity1,
      Entry,
      Identity
    })
    replica2 = new Replica({
      manifest,
      directory: testPaths2.replica,
      Datastore,
      blocks: blocks2,
      access,
      identity: identity2,
      Entry,
      Identity
    })
    await start(replica1, replica2)

    replicator1 = new Replicator({
      ipfs: ipfs1,
      libp2p: libp2p1,
      manifest,
      blocks: blocks1,
      replica: replica1,
      access,
      Entry,
      Identity
    })
    replicator2 = new Replicator({
      ipfs: ipfs2,
      libp2p: libp2p2,
      manifest,
      blocks: blocks2,
      replica: replica2,
      access,
      Entry,
      Identity
    })
  })

  after(async () => {
    await stop(access)
    await stop(replica1, replica2)
    await stop(replicator1, replicator2)
    await stop(ipfs1, ipfs2)
  })

  describe('instance', () => {
    it('exposes instance properties', () => {
      const replicator = replicator1
      assert.isOk(replicator.broadcast)
    })

    before(async () => {
      await start(replicator1, replicator2)
      await Promise.all([ipfs1.swarm.connect(addr2), ipfs2.swarm.connect(addr1)])
    })

    it('replicates replica entries and identities', async () => {
      const promise = replica1.write(new Uint8Array())

      await Promise.all([
        new Promise((resolve) =>
          replica2.events.addEventListener('update', resolve, { once: true })
        ),
        promise
      ])
    })
  })
})
