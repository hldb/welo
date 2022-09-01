
// when you need sample entries and don't care about ordering
async function sampleEntries ({ number, Entry, identity, tag, getPayload }) {
  tag = tag || new Uint8Array()
  getPayoad = getPayload || () => ({})

  const entries = []
  while (entries.length < number) {
    const payload = getPayload()
    const next = entries.slice(entries.length - (entries % 3)).map(entry => entry.block.cid)
    const refs = []
    const entry = await Entry.create({ identity, tag, payload, next, refs })
    entries.push(entry)
  }

  return entries
}

export { sampleEntries }
