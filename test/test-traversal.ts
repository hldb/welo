import { strict as assert } from 'assert'

import { Blocks } from '../src/mods/blocks.js'
import { Entry } from '../src/manifest/entry/index.js'
import { Identity } from '../src/manifest/identity/index.js'
import { StaticAccess } from '../src/manifest/access/static.js'
import { Graph } from '../src/database/graph.js'
import {
  sortCids,
  sortEntries,
  sortEntriesRev,
  loadEntry,
  dagLinks,
  graphLinks,
  traverser
} from '../src/database/traversal.js'
import { cidstring } from '../src/util.js'

import {
  getIpfs,
  getIdentity,
  writeManifest,
  singleEntry,
  concurrentEntries,
  getStorageReturn
} from './utils/index.js'
import { IPFS } from 'ipfs'
import { Manifest } from '../src/manifest/index.js'
import { CID } from 'multiformats/cid.js'

describe('traversal', () => {
  let ipfs: IPFS,
    blocks: Blocks,
    storage: getStorageReturn,
    identity: Identity,
    access: StaticAccess,
    noaccess: StaticAccess

  const entries: Entry[] = []

  const tag = new Uint8Array()
  const next: CID[] = []
  const refs: CID[] = []
  const payload = {}

  before(async () => {
    ipfs = await getIpfs()
    blocks = new Blocks(ipfs)

    const got = await getIdentity()
    storage = got.storage
    identity = got.identity

    access = await StaticAccess.open({
      manifest: await Manifest.create({ access: { write: [identity.id] } })
    })
    noaccess = await StaticAccess.open({
      manifest: await Manifest.create({ access: { write: ['nobody'] } })
    })

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
    await storage.close()
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

      const loaded = await load(cid)
      assert.equal(cidstring(loaded.cid), cidstring(entry.cid)) // one is a buffer and one is a uint8array if not stringified
    })

    it('returns null if cid resolves to malformed entry', () => {})
  })

  describe('dagLinks', () => {
    it('returns an array of cids from the dag node', () => {
      const graph = Graph.init()
      const links = dagLinks({ graph, access })
      const entry = entries[1]

      assert.deepEqual(links(entry), [entries[0].cid])
    })

    it('returns an empty array if there are no links in the dag node', () => {
      const graph = Graph.init()
      const links = dagLinks({ graph, access })
      const entry = entries[0]

      assert.deepEqual(links(entry), [])
    })

    it('returns an empty array if entry cannot be appended', () => {
      const graph = Graph.init()
      const links = dagLinks({ graph, access: noaccess })
      const entry = entries[1]

      assert.deepEqual(links(entry), [])
    })

    it('returns an empty array if all cids have been seen', () => {
      const graph = Graph.init()
      const links = dagLinks({ graph, access })
      const entry = entries[1]

      assert.deepEqual(links(entry), [entries[0].cid])
      assert.deepEqual(links(entry), [])
    })

    it('returns an empty array if all cids are already added to the graph', () => {
      const graph = Graph.init()
      const links = dagLinks({ graph, access })
      const entry = entries[1]

      Graph.add(graph, entry.cid, entry.next)
      Graph.add(graph, entries[0].cid, [])

      assert.deepEqual(links(entry), [])
    })
  })

  describe('graphLinks', () => {
    before(() => {})

    it('returns an array if cids from the graph node', () => {
      const graph = Graph.init()
      const tails: Set<string> = new Set()
      const edge = 'out'
      const entry = entries[1]

      Graph.add(graph, entries[0].cid, [])
      Graph.add(graph, entries[1].cid, [entries[0].cid])

      const links = graphLinks({ graph, tails, edge })

      assert.deepEqual(links(entry), [entries[0].cid])
    })

    it('returns an emtpy array if graph node edge is empty', () => {
      const graph = Graph.init()
      const tails: Set<string> = new Set()
      const edge = 'out'
      const entry = entries[0]

      Graph.add(graph, entries[0].cid, [])
      Graph.add(graph, entries[1].cid, [entries[0].cid])

      const links = graphLinks({ graph, tails, edge })

      assert.deepEqual(links(entry), [])
    })

    it('returns an array of cids for a specified direction', () => {
      const graph = Graph.init()
      const tails: Set<string> = new Set()
      const edge = 'in'
      const entry = entries[0]

      Graph.add(graph, entries[0].cid, [])
      Graph.add(graph, entries[1].cid, [entries[0].cid])

      const links = graphLinks({ graph, tails, edge })

      assert.deepEqual(links(entry), [entries[1].cid])
    })

    it('returns an empty array if entry cid exists in tails', () => {
      const graph = Graph.init()
      const tails = new Set([cidstring(entries[1].cid)])
      const edge = 'out'
      const entry = entries[1]

      Graph.add(graph, entries[0].cid, [])
      Graph.add(graph, entries[1].cid, [entries[0].cid])

      const links = graphLinks({ graph, tails, edge })

      assert.deepEqual(links(entry), [])
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
    const setHeads = (topo: Entry[], entries: Entry[]) =>
      heads.set(
        topo,
        entries.map((entry) => entry.cid)
      )

    before(async () => {
      const id0 = identity
      const { storage, identity: id1 } = await getIdentity()
      await storage.close()
      await blocks.put(id1.block)

      const manifest = await writeManifest({
        access: { write: [id0.id, id1.id] }
      })
      sharedAccess = await StaticAccess.open({ manifest })

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

            const graph = Graph.init()
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
            const graph = Graph.init()
            for (const entry of topology) {
              Graph.add(graph, entry.cid, entry.next)
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
            const graph = Graph.init()
            for (const entry of topology) {
              Graph.add(graph, entry.cid, entry.next)
            }

            const tails = graph.heads
            const edge = 'in'
            const load = loadEntry({ blocks, Entry, Identity })
            const links = graphLinks({ graph, tails, edge })
            const orderFn = sortEntriesRev

            const cids = topology
              .filter((entry) => !entry.next.length)
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
