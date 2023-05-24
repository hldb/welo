import { assert } from './utils/chai.js'
import type { Helia } from '@helia/interface'
import type { CID } from 'multiformats/cid'
import { start } from '@libp2p/interfaces/startable'
import type { HashMap } from 'ipld-hashmap'

import {
  sortCids,
  sortEntries,
  sortEntriesRev,
  loadEntry,
  dagLinks,
  graphLinks,
  traverser
} from '@/replica/traversal.js'
import { Blocks } from '@/blocks/index.js'
import type { EntryInstance } from '@/entry/interface.js'
import { Entry } from '@/entry/basal/index.js'
import { Identity } from '@/identity/basal/index.js'
import { Keyvalue } from '@/store/keyvalue/index.js'
import { StaticAccess } from '@/access/static/index.js'
import { Graph, loadHashMap } from '@/replica/graph.js'
import { cidstring } from '@/utils/index.js'
import { initRegistry } from '../src/registry.js'
import { Manifest } from '@/manifest/index.js'

import defaultManifest from './utils/defaultManifest.js'
import { getTestIpfs, offlineIpfsOptions } from './utils/ipfs.js'
import { getTestPaths, names, tempPath } from './utils/constants.js'
import { getTestIdentities, getTestIdentity } from './utils/identities.js'
import { concurrentEntries, singleEntry } from './utils/entries.js'
import { getTestLibp2p } from './utils/libp2p.js'

const testName = 'traversal'

describe('traversal', () => {
  let ipfs: Helia,
    blocks: Blocks,
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

  const registry = initRegistry()

  registry.store.add(Keyvalue)
  registry.access.add(StaticAccess)
  registry.entry.add(Entry)
  registry.identity.add(Identity)

  before(async () => {
    const testPaths = getTestPaths(tempPath, testName)
    ipfs = await getTestIpfs(testPaths, offlineIpfsOptions)
    blocks = new Blocks(ipfs)

    const identities = await getTestIdentities(testPaths)
    const libp2p = await getTestLibp2p(ipfs)
    const keychain = libp2p.keychain

    identity = await getTestIdentity(identities, keychain, names.name0)
    identity1 = await getTestIdentity(identities, keychain, names.name1)

    access = new StaticAccess({
      manifest: await Manifest.create({
        ...defaultManifest(name, identity),
        access: {
          protocol: StaticAccess.protocol,
          config: { write: [identity.id] }
        }
      })
    })
    noaccess = new StaticAccess({
      manifest: await Manifest.create({
        ...defaultManifest(name, identity),
        access: {
          protocol: StaticAccess.protocol,
          config: { write: ['nobody'] }
        }
      })
    })
    await start(access, noaccess)

    entries[0] = await Entry.create({
      identity,
      tag,
      next,
      refs,
      payload
    })
    entries[1] = await Entry.create({
      identity,
      tag,
      next: [entries[0].cid],
      refs,
      payload
    })
    entries[2] = await Entry.create({
      identity,
      tag,
      next: [entries[1].cid],
      refs,
      payload
    })

    await blocks.put(identity.block)
    await blocks.put(entries[0].block)
    await blocks.put(entries[1].block)
    await blocks.put(entries[2].block)
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
      const load = loadEntry({ blocks, Entry, Identity })
      const entry = entries[0]
      const cid = entry.cid

      const loaded = (await load(cid)) as EntryInstance<any>
      assert.strictEqual(cidstring(loaded.cid), cidstring(entry.cid)) // one is a buffer and one is a uint8array if not stringified
    })

    it('returns null if cid resolves to malformed entry', () => {})
  })

  describe('dagLinks', () => {
    it('returns an array of cids from the dag node', async () => {
      const graph = new Graph({ blocks })
      await start(graph)

      const links = dagLinks({ graph, access })
      const entry = entries[1]

      assert.deepEqual(await links(entry), [entries[0].cid])
    })

    it('returns an empty array if there are no links in the dag node', async () => {
      const graph = new Graph({ blocks })
      await start(graph)

      const links = dagLinks({ graph, access })
      const entry = entries[0]

      assert.deepEqual(await links(entry), [])
    })

    it('returns an empty array if entry cannot be appended', async () => {
      const graph = new Graph({ blocks })
      await start(graph)

      const links = dagLinks({ graph, access: noaccess })
      const entry = entries[1]

      assert.deepEqual(await links(entry), [])
    })

    it('returns an empty array if all cids have been seen', async () => {
      const graph = new Graph({ blocks })
      await start(graph)

      const links = dagLinks({ graph, access })
      const entry = entries[1]

      assert.deepEqual(await links(entry), [entries[0].cid])
      assert.deepEqual(await links(entry), [])
    })

    it('returns an empty array if all cids are already added to the graph', async () => {
      const graph = new Graph({ blocks })
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
      const graph = new Graph({ blocks })
      await start(graph)

      const tails: HashMap<null> = await loadHashMap(blocks)
      const edge = 'out'
      const entry = entries[1]

      await graph.add(entries[0].cid, [])
      await graph.add(entries[1].cid, [entries[0].cid])

      const links = graphLinks({ graph, tails, edge })

      assert.deepEqual(await links(entry), [entries[0].cid])
    })

    it('returns an emtpy array if graph node edge is empty', async () => {
      const graph = new Graph({ blocks })
      await start(graph)

      const tails: HashMap<null> = await loadHashMap(blocks)
      const edge = 'out'
      const entry = entries[0]

      await graph.add(entries[0].cid, [])
      await graph.add(entries[1].cid, [entries[0].cid])

      const links = graphLinks({ graph, tails, edge })

      assert.deepEqual(await links(entry), [])
    })

    it('returns an array of cids for a specified direction', async () => {
      const graph = new Graph({ blocks })
      await start(graph)

      const tails: HashMap<null> = await loadHashMap(blocks)
      const edge = 'in'
      const entry = entries[0]

      await graph.add(entries[0].cid, [])
      await graph.add(entries[1].cid, [entries[0].cid])

      const links = graphLinks({ graph, tails, edge })

      assert.deepEqual(await links(entry), [entries[1].cid])
    })

    it('returns an empty array if entry cid exists in tails', async () => {
      const graph = new Graph({ blocks })
      await start(graph)

      const tails: HashMap<null> = await loadHashMap(blocks)
      await tails.set(cidstring(entries[1].cid), null)
      const edge = 'out'
      const entry = entries[1]

      await graph.add(entries[0].cid, [])
      await graph.add(entries[1].cid, [entries[0].cid])

      const links = graphLinks({ graph, tails, edge })

      assert.deepEqual(await links(entry), [])
    })

    it('throws if there is no node in graph for referenced cid', async () => {
      const graph = new Graph({ blocks })
      await start(graph)

      const tails: HashMap<null> = await loadHashMap(blocks)
      const edge = 'out'
      const entry = entries[1]

      const links = graphLinks({ graph, tails, edge })

      await assert.isRejected(links(entry))
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

    const topologies: { [string: string]: Entry[] } = {
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
      await blocks.put(id1.block)

      const manifest = await Manifest.create({
        ...defaultManifest(name, identity),
        access: {
          protocol: StaticAccess.protocol,
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
              promises.push(blocks.put(entry.block))
            }
            await Promise.all(promises)

            const graph = new Graph({ blocks })
            await start(graph)

            const load = loadEntry({ blocks, Entry, Identity })
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
            const graph = new Graph({ blocks })
            await start(graph)

            for (const entry of topology) {
              await graph.add(entry.cid, entry.next)
            }

            const tails = graph.tails
            const edge = 'out'
            const load = loadEntry({ blocks, Entry, Identity })
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
            const graph = new Graph({ blocks })
            await start(graph)

            for (const entry of topology) {
              await graph.add(entry.cid, entry.next)
            }

            const tails = graph.heads
            const edge = 'in'
            const load = loadEntry({ blocks, Entry, Identity })
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
