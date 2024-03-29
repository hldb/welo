/* eslint-disable no-loop-func */
/* eslint-disable guard-for-in */
/* eslint-disable max-nested-callbacks */
import { start } from '@libp2p/interfaces/startable'
import { assert, expect } from 'aegir/chai'
import { Key } from 'interface-datastore'
import { getTestPaths, names, tempPath } from './utils/constants.js'
import defaultManifest from './utils/default-manifest.js'
import { concurrentEntries, singleEntry } from './utils/entries.js'
import { getTestIdentities, getTestIdentity } from './utils/identities.js'
import { getTestIpfs, offlineIpfsOptions } from './utils/ipfs.js'
import { getTestLibp2p } from './utils/libp2p.js'
import type { EntryInstance } from '@/entry/interface.js'
import type { GossipHelia } from '@/interface.js'
import type { Blockstore } from 'interface-blockstore'
import type { CID } from 'multiformats/cid'
import { StaticAccess } from '@/access/static/index.js'
import staticAccessProtocol from '@/access/static/protocol.js'
import { type Entry, basalEntry } from '@/entry/basal/index.js'
import { type Identity, basalIdentity } from '@/identity/basal/index.js'
import { Manifest } from '@/manifest/index.js'
import { Graph } from '@/replica/graph.js'
import {
  sortCids,
  sortEntries,
  sortEntriesRev,
  loadEntry,
  dagLinks,
  graphLinks,
  traverser
} from '@/replica/traversal.js'
import { cidstring } from '@/utils/index.js'
import { Paily } from '@/utils/paily.js'

const testName = 'traversal'

describe('traversal', () => {
  let ipfs: GossipHelia,
    blockstore: Blockstore,
    identity: Identity,
    identity1: Identity,
    access: StaticAccess,
    noaccess: StaticAccess

  const name = 'name'

  const entries: Entry[] = []

  const tag = new Uint8Array()
  const next: CID[] = []
  const refs: CID[] = []
  const payload = {}
  const entryModule = basalEntry()
  const identityModule = basalIdentity()

  before(async () => {
    const testPaths = getTestPaths(tempPath, testName)
    ipfs = await getTestIpfs(testPaths, offlineIpfsOptions)
    blockstore = ipfs.blockstore

    const identities = await getTestIdentities(testPaths)
    const libp2p = await getTestLibp2p(ipfs)
    const keychain = libp2p.services.keychain

    identity = await getTestIdentity(identities, keychain, names.name0)
    identity1 = await getTestIdentity(identities, keychain, names.name1)

    access = new StaticAccess({
      manifest: await Manifest.create({
        ...defaultManifest(name, identity),
        access: {
          protocol: staticAccessProtocol,
          config: { write: [identity.id] }
        }
      })
    })
    noaccess = new StaticAccess({
      manifest: await Manifest.create({
        ...defaultManifest(name, identity),
        access: {
          protocol: staticAccessProtocol,
          config: { write: ['nobody'] }
        }
      })
    })
    await start(access, noaccess)

    entries[0] = await entryModule.create({
      identity,
      tag,
      next,
      refs,
      payload
    })
    entries[1] = await entryModule.create({
      identity,
      tag,
      next: [entries[0].cid],
      refs,
      payload
    })
    entries[2] = await entryModule.create({
      identity,
      tag,
      next: [entries[1].cid],
      refs,
      payload
    })

    await blockstore.put(identity.block.cid, identity.block.bytes)
    await blockstore.put(entries[0].block.cid, entries[0].block.bytes)
    await blockstore.put(entries[1].block.cid, entries[1].block.bytes)
    await blockstore.put(entries[2].block.cid, entries[2].block.bytes)
  })

  after(async () => {
    await ipfs.stop()
  })

  describe('sortCids', () => {
    const cids = entries.map((e) => e.cid)

    it('sorts two cids', () => {
      assert.deepEqual(cids.sort(sortCids), cids)
    })
  })

  describe('sortEntries', () => {
    it('sorts two entries by cid', () => {
      const entriesCopy = entries.slice()
      assert.deepEqual(
        entriesCopy.sort(sortEntries),
        entriesCopy.sort((e1, e2) => sortCids(e1.cid, e2.cid))
      )
    })
  })

  describe('load', () => {
    it('returns an entry by cid', async () => {
      const load = loadEntry({ blockstore, entry: entryModule, identity: identityModule })
      const entry = entries[0]
      const cid = entry.cid

      const loaded = (await load(cid)) as EntryInstance<any>
      assert.strictEqual(cidstring(loaded.cid), cidstring(entry.cid)) // one is a buffer and one is a uint8array if not stringified
    })

    it('returns null if cid resolves to malformed entry', () => {})
  })

  describe('dagLinks', () => {
    it('returns an array of cids from the dag node', async () => {
      const graph = new Graph(blockstore)
      await start(graph)

      const links = dagLinks({ graph, access })
      const entry = entries[1]

      assert.deepEqual(await links(entry), [entries[0].cid])
    })

    it('returns an empty array if there are no links in the dag node', async () => {
      const graph = new Graph(blockstore)
      await start(graph)

      const links = dagLinks({ graph, access })
      const entry = entries[0]

      assert.deepEqual(await links(entry), [])
    })

    it('returns an empty array if entry cannot be appended', async () => {
      const graph = new Graph(blockstore)
      await start(graph)

      const links = dagLinks({ graph, access: noaccess })
      const entry = entries[1]

      assert.deepEqual(await links(entry), [])
    })

    it('returns an empty array if all cids have been seen', async () => {
      const graph = new Graph(blockstore)
      await start(graph)

      const links = dagLinks({ graph, access })
      const entry = entries[1]

      assert.deepEqual(await links(entry), [entries[0].cid])
      assert.deepEqual(await links(entry), [])
    })

    it('returns an empty array if all cids are already added to the graph', async () => {
      const graph = new Graph(blockstore)
      await start(graph)

      const links = dagLinks({ graph, access })
      const entry = entries[1]

      await graph.add(entry.cid, entry.next)
      await graph.add(entries[0].cid, [])

      assert.deepEqual(await links(entry), [])
    })
  })

  describe('graphLinks', () => {
    it('returns an array if cids from the graph node', async () => {
      const graph = new Graph(blockstore)
      await start(graph)

      const tails: Paily = await Paily.create(blockstore)
      const edge = 'out'
      const entry = entries[1]

      await graph.add(entries[0].cid, [])
      await graph.add(entries[1].cid, [entries[0].cid])

      const links = graphLinks({ graph, tails, edge })

      assert.deepEqual(await links(entry), [entries[0].cid])
    })

    it('returns an emtpy array if graph node edge is empty', async () => {
      const graph = new Graph(blockstore)
      await start(graph)

      const tails: Paily = await Paily.create(blockstore)
      const edge = 'out'
      const entry = entries[0]

      await graph.add(entries[0].cid, [])
      await graph.add(entries[1].cid, [entries[0].cid])

      const links = graphLinks({ graph, tails, edge })

      assert.deepEqual(await links(entry), [])
    })

    it('returns an array of cids for a specified direction', async () => {
      const graph = new Graph(blockstore)
      await start(graph)

      const tails: Paily = await Paily.create(blockstore)
      const edge = 'in'
      const entry = entries[0]

      await graph.add(entries[0].cid, [])
      await graph.add(entries[1].cid, [entries[0].cid])

      const links = graphLinks({ graph, tails, edge })

      assert.deepEqual(await links(entry), [entries[1].cid])
    })

    it('returns an empty array if entry cid exists in tails', async () => {
      const graph = new Graph(blockstore)
      await start(graph)

      const tails: Paily = await Paily.create(blockstore)
      await tails.put(new Key(cidstring(entries[1].cid)), new Uint8Array())
      const edge = 'out'
      const entry = entries[1]

      await graph.add(entries[0].cid, [])
      await graph.add(entries[1].cid, [entries[0].cid])

      const links = graphLinks({ graph, tails, edge })

      assert.deepEqual(await links(entry), [])
    })

    it('throws if there is no node in graph for referenced cid', async () => {
      const graph = new Graph(blockstore)
      await start(graph)

      const tails: Paily = await Paily.create(blockstore)
      const edge = 'out'
      const entry = entries[1]

      const links = graphLinks({ graph, tails, edge })

      await expect(links(entry)).to.eventually.be.rejected()
    })
  })

  describe('traverser', () => {
    let sharedAccess: StaticAccess

    const single = singleEntry
    const concurrent = concurrentEntries

    // names that represent the topological shape
    const stick: Entry[] = [] // 3 consecutive
    const eleven: Entry[] = [] // 3 concurrent
    const sticklegs: Entry[] = [] // 1 concurrent 2 consecutive
    const snaketongue: Entry[] = [] // 1 concurrent 2 consecutive
    const diamond: Entry[] = [] // 1 concurrent 2 consecutive
    const lamda: Entry[] = [] // 2 concurrent 1 consecutive
    const x: Entry[] = [] // 2 concurrent 1 consecutive
    const v: Entry[] = [] // 2 concurrent 1 consecutive

    const topologies: Record<string, Entry[]> = {
      stick,
      eleven,
      sticklegs,
      snaketongue,
      diamond,
      lamda,
      x,
      v
    }

    const heads = new Map()
    const setHeads = (topo: Entry[], entries: Entry[]): Map<Entry[], CID[]> =>
      heads.set(
        topo,
        entries.map((entry) => entry.cid)
      )

    before(async () => {
      const id0 = identity
      const id1 = identity1
      await blockstore.put(id1.block.cid, id1.block.bytes)

      const manifest = await Manifest.create({
        ...defaultManifest(name, identity),
        access: {
          protocol: staticAccessProtocol,
          config: { write: [id0.id, id1.id] }
        }
      })
      sharedAccess = new StaticAccess({ manifest })
      await start(sharedAccess)

      stick[0] = await single(id0)([])
      stick[1] = await single(id0)([stick[0]])
      stick[2] = await single(id0)([stick[1]])
      setHeads(stick, [stick[2]])
      ;[eleven[0], eleven[1]] = await concurrent([id0, id1])([[], []])
      ;[eleven[2], eleven[3]] = await concurrent([id0, id1])([
        [eleven[0]],
        [eleven[1]]
      ])
      ;[eleven[4], eleven[5]] = await concurrent([id0, id1])([
        [eleven[2]],
        [eleven[3]]
      ])
      setHeads(eleven, [eleven[4], eleven[5]])

      sticklegs[0] = await single(id0)([])
      sticklegs[1] = await single(id0)([sticklegs[0]])
      ;[sticklegs[2], sticklegs[3]] = await concurrent([id0, id1])([
        [sticklegs[1]],
        [sticklegs[1]]
      ])
      setHeads(sticklegs, [sticklegs[2], sticklegs[3]])
      ;[snaketongue[0], snaketongue[1]] = await concurrent([id0, id1])([[], []])
      snaketongue[2] = await single(id0)([snaketongue[0], snaketongue[1]])
      snaketongue[3] = await single(id0)([snaketongue[2]])
      setHeads(snaketongue, [snaketongue[3]])

      diamond[0] = await single(id0)([])
      ;[diamond[1], diamond[2]] = await concurrent([id0, id1])([
        [diamond[0]],
        [diamond[0]]
      ])
      diamond[3] = await single(id0)([diamond[1], diamond[2]])
      setHeads(diamond, [diamond[3]])

      lamda[0] = await single(id0)([])
      ;[lamda[1], lamda[2]] = await concurrent([id0, id1])([
        [lamda[0]],
        [lamda[0]]
      ])
      ;[lamda[3], lamda[4]] = await concurrent([id0, id1])([
        [lamda[1]],
        [lamda[2]]
      ])
      setHeads(lamda, [lamda[3], lamda[4]])
      ;[x[0], x[1]] = await concurrent([id0, id1])([[], []])
      x[2] = await single(id0)([x[0], x[1]])
      ;[x[3], x[4]] = await concurrent([id0, id1])([[x[2]], [x[2]]])
      setHeads(x, [x[3], x[4]])
      ;[v[0], v[1]] = await concurrent([id0, id1])([[], []])
      ;[v[2], v[3]] = await concurrent([id0, id1])([[v[0]], [v[1]]])
      v[4] = await single(id0)([v[2], v[3]])
      setHeads(v, [v[4]])
    })

    describe('dag links', () => {
      describe('descending traversal', () => {
        for (const key in topologies) {
          const topology = topologies[key]

          it(`yields unordered entries in a ${key} topology`, async () => {
            const promises = []
            for (const entry of topology) {
              // promises.push(blocks.put(entry.block.bytes, { format: 'dag-cbor' }))
              promises.push(blockstore.put(entry.block.cid, entry.block.bytes))
            }
            await Promise.all(promises)

            const graph = new Graph(blockstore)
            await start(graph)

            const load = loadEntry({ blockstore, entry: entryModule, identity: identityModule })
            const links = dagLinks({ graph, access: sharedAccess })

            const cids = heads.get(topology)
            const source = await traverser({
              cids,
              load,
              links
            })

            const entries = []
            for (const entry of source) {
              entries.push(entry)
            }

            assert.deepEqual(
              new Set(entries.map((entry) => cidstring(entry.cid))),
              new Set(topology.map((entry) => cidstring(entry.cid)))
            )
          })
        }
      })
    })

    describe('graph links', () => {
      describe('descending traversal', () => {
        for (const key in topologies) {
          const topology = topologies[key]

          it(`yields ordered entries in a ${key} topology`, async () => {
            const graph = new Graph(blockstore)
            await start(graph)

            for (const entry of topology) {
              await graph.add(entry.cid, entry.next)
            }

            const tails = graph.tails
            const edge = 'out'
            const load = loadEntry({ blockstore, entry: entryModule, identity: identityModule })
            const links = graphLinks({ graph, tails, edge })
            const orderFn = sortEntries

            const cids = heads.get(topology)
            const source = await traverser({ cids, load, links, orderFn })

            const entries = []
            for (const entry of source) {
              entries.push(entry)
            }

            assert.deepEqual(
              entries.map((entry) => cidstring(entry.cid)),
              topology
                .slice()
                .reverse()
                .map((entry) => cidstring(entry.cid))
            )
          })
        }
      })

      describe('ascending traversal', () => {
        for (const key in topologies) {
          const topology = topologies[key]

          it(`yields ordered entries in a ${key} topology`, async () => {
            const graph = new Graph(blockstore)
            await start(graph)

            for (const entry of topology) {
              await graph.add(entry.cid, entry.next)
            }

            const tails = graph.heads
            const edge = 'in'
            const load = loadEntry({ blockstore, entry: entryModule, identity: identityModule })
            const links = graphLinks({ graph, tails, edge })
            const orderFn = sortEntriesRev

            const cids = topology
              .filter((entry) => entry.next.length === 0)
              .map((entry) => entry.cid) // get the tails to start from
            const source = await traverser({ cids, load, links, orderFn })

            const entries = []
            for (const entry of source) {
              entries.push(entry)
            }

            assert.deepEqual(
              entries.map((entry) => cidstring(entry.cid)),
              topology.map((entry) => cidstring(entry.cid))
            )
          })
        }
      })
    })
  })
})
