
// the goal is to make a traverser that can read and replicate entries
// when reading entries we want the traverser to visit only known entries and in order
// when replicating entries we want the traverser to visit only unknown entries in any order

// import { pushable } from 'it-pushable'
// import { paramap } from 'paramap-it'
import { compare } from 'uint8arrays/compare'
import { cidstring, parsedcid } from '../util.js'

// thinking about keeping this as only sorting metric after causal links
export const sortCids = (c1, c2) => compare(c1.bytes, c2.bytes)
export const sortEntries = (e1, e2) => sortCids(e1.cid, e2.cid)
export const sortEntriesRev = (e1, e2) => sortCids(e2.cid, e1.cid)

export function loadEntry ({ blocks, Entry, Identity }) {
  return async function (cid) {
    return Entry.fetch({ blocks, cid, Identity })
  }
}

// used by replicators to fetch new entries from the dag
// if entry is not allow to write to log return no links
// only return links that have not been seen or are unknown to graph
export function dagLinks ({ graph, access, seen }) {
  seen = seen || new Set()

  return function (entry) {
    if (!access.canAppend(entry)) {
      return []
    }

    const cids = []
    for (const cid of entry.next) {
      const str = cidstring(cid)
      if (seen.has(str) || graph.has(str)) continue

      seen.add(str)
      cids.push(cid)
    }

    return cids
  }
}

// used by replica to traverse with help of graph
export function graphLinks ({ graph, tails, edge, seen }) {
  seen = seen || new Set()

  return function (entry) {
    const str = cidstring(entry.cid)

    // do not traverse past the tails
    if (tails.has(str)) {
      return []
    }

    const adjacents = graph.get(str)[edge]

    const cids = []
    for (const str of adjacents) {
      if (seen.has(str) || !graph.has(str)) continue

      seen.add(str)
      cids.push(parsedcid(str))
    }

    return cids
  }
}

// todo: improve read ahead with entry.refs
export async function traverser ({
  cids, // set of CID to start from
  load, // load function takes a cid and returns an entry or null
  links, // links function takes an object containing an entry or cid and returns an array of cid
  orderFn, // if supplied the entries are yielded in order with ties handled by orderFn
  signal // abort signal https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal
}) {
  const ordered = orderFn instanceof Function
  const result = []

  // const source = pushable({ objectMode: true })

  // ordered vs parallel
  // const order = cids => ordered ? walk(cids) : Promise.all(cids.map(cid => walk([cid])))

  async function walk (cids) {
    // trivial abort for now; later pass abort to load function

    const entries = await Promise.all(Array.from(cids).map(load))
      .then(entries => entries.filter(Boolean)) // eliminate null load returns

    if (ordered) entries.sort(orderFn)

    // entries.forEach(entry => source.push(entry))
    entries.forEach(entry => result.push(entry))

    // get next cids; links function must only return unseen cids so there are no duplicate cids in nexts
    const nexts = entries.flatMap(entry => links(entry)).sort(sortCids) // combine link arrays

    if (nexts.length) {
      // order(nexts)
      return walk(new Set(nexts))
    }
  }

  // return order(Array.from(cids)).then(() => source.end()) // todo: eliminate order function, move logic into walk
  await walk(cids)
  return result
}
