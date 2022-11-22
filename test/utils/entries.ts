import { Entry } from '~entry/basal/index.js'
import { Identity } from '~identity/basal/index.js'
import { sortEntriesRev } from '~database/traversal.js'

export const entryData = {
  tag: new Uint8Array(),
  payload: {},
  next: [],
  refs: []
}

export const singleEntry =
  (identity: Identity) =>
    async (nextEntries: Entry[] = []) =>
      await Entry.create({
        ...entryData,
        identity,
        next: nextEntries.map((entry) => entry.cid)
      })

export const concurrentEntries =
  (identities: Identity[]) => async (nextEntriesA: Entry[][]) => {
    const entries: Array<Promise<Entry>> = []
    for (const identity of identities) {
      const nextEntries: Entry[] = nextEntriesA[entries.length]
      entries.push(singleEntry(identity)(nextEntries))
    }
    return await Promise.all(entries).then((entries) =>
      entries.sort(sortEntriesRev)
    )
  }
