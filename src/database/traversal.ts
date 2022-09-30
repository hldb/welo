import { CID } from 'multiformats/cid'
import { compare } from 'uint8arrays/compare'
// import { pushable } from 'it-pushable'
// import { paramap } from 'paramap-it'

import { Blocks } from '../mods/blocks.js'
import { cidstring, parsedcid } from '../utils/index.js'
import { Graph, Edge } from './graph.js'
import { EntryInstance, EntryStatic } from '../entry/interface.js'
import { IdentityStatic } from '../identity/interface.js'
import { AccessInstance } from '../access/interface.js'

// the goal is to make a traverser that can read and replicate entries
// when reading entries we want the traverser to visit only known entries and in order
// when replicating entries we want the traverser to visit only unknown entries in any order

type SortCids = (c1: CID, c2: CID) => number
type SortEntries = (e1: EntryInstance<any>, e2: EntryInstance<any>) => number

// thinking about keeping this as only sorting metric after causal links
export const sortCids: SortCids = (c1, c2) => compare(c1.bytes, c2.bytes)
export const sortEntries: SortEntries = (e1, e2) => sortCids(e1.cid, e2.cid)
export const sortEntriesRev: SortEntries = (e1, e2) => sortCids(e2.cid, e1.cid)

export type LoadFunc = (cid: CID) => Promise<EntryInstance<any>>
export type LinksFunc = (entry: EntryInstance<any>) => Promise<CID[]>

export function loadEntry ({
  blocks,
  Entry,
  Identity
}: {
  blocks: Blocks
  Entry: EntryStatic<any>
  Identity: IdentityStatic<any>
}): LoadFunc {
  const load: LoadFunc = async function (cid: CID) {
    return await Entry.fetch({ blocks, cid, Identity })
  }
  return load
}

// used by replicators to fetch new entries from the dag
// if entry is not allow to write to log return no links
// only return links that have not been seen or are unknown to graph
export function dagLinks ({
  graph,
  access
}: {
  graph: Graph
  access: AccessInstance
}): LinksFunc {
  const seen: Set<string> = new Set()

  const links: LinksFunc = async function (entry: EntryInstance<any>) {
    if (!await access.canAppend(entry)) {
      return []
    }

    const cids: CID[] = []
    for (const cid of entry.next) {
      const str = cidstring(cid)
      if (seen.has(str) || graph.has(str)) continue

      seen.add(str)
      cids.push(cid)
    }

    return cids
  }

  return links
}

// used by replica to traverse with help of graph
export function graphLinks ({
  graph,
  tails,
  edge
}: {
  graph: Graph
  tails: Set<string>
  edge: Edge
}): LinksFunc {
  const seen: Set<string> = new Set()

  const links: LinksFunc = async function (entry: EntryInstance<any>) {
    const str = cidstring(entry.cid)

    // do not traverse past the tails
    if (tails.has(str)) {
      return []
    }

    const node = graph.get(str)
    if (node === undefined) {
      throw new Error('graphLinks: graph has entered corrupted state')
    }

    const adjacents = node[edge]

    const cids: CID[] = []
    for (const str of adjacents) {
      if (seen.has(str) || !graph.has(str)) continue

      seen.add(str)
      cids.push(parsedcid(str))
    }

    return cids
  }

  return links
}

// todo: improve read ahead with entry.refs
export async function traverser ({
  cids, // array of CID to start from
  load, // load function takes a cid and returns an entry or null
  links, // links function takes an object containing an entry or cid and returns an array of cid
  orderFn // if supplied the entries are yielded in order with ties handled by orderFn
}: {
  cids: CID[]
  load: LoadFunc
  links: LinksFunc
  orderFn?: SortEntries
  // signal: AbortSignal
}): Promise<Array<EntryInstance<any>>> {
  const ordered = orderFn instanceof Function
  const result: Array<EntryInstance<any>> = []

  // const source = pushable({ objectMode: true })

  // ordered vs parallel
  // const order = cids => ordered ? walk(cids) : Promise.all(cids.map(cid => walk([cid])))

  async function walk (cids: CID[]): Promise<void> {
    // trivial abort for now; later pass abort to load function

    const entries = await Promise.all(cids.map(load)).then((entries) =>
      entries.filter(Boolean)
    ) // eliminate null load returns

    if (ordered) entries.sort(orderFn)

    // entries.forEach(entry => source.push(entry))
    entries.forEach((entry) => result.push(entry))

    // get next cids; links function must only return unseen cids so there are no duplicate cids in nexts
    const nexts: CID[] = await Promise.all(entries.map(async (entry) => await links(entry)))
      // flatten array of links which is an array of CIDs
      .then(arr => arr.flatMap(links => links).sort(sortCids))

    if (nexts.length > 0) {
      // order(nexts)
      return await walk(nexts) // combine link arrays
    }
  }

  // return order(Array.from(cids)).then(() => source.end()) // todo: eliminate order function, move logic into walk
  await walk(cids)
  return result
}
