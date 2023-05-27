import all from 'it-all'
import { dagLinks, loadEntry, traverser } from '@/replica/traversal.js'
import { parsedcid } from '@/utils/index.js'
import createWelo from '@/utils/createDefaultWelo.js'
import { getTestPaths, tempPath } from '../test/utils/constants.js'
import { getTestIpfs, offlineIpfsOptions } from '../test/utils/ipfs.js'

const paths = getTestPaths(tempPath, 'benchmark')
const ipfs = await getTestIpfs(paths, offlineIpfsOptions)
if (ipfs.libp2p == null) {
  throw new Error('ipfs.libp2p is not defined')
}

const welo = await createWelo({ ipfs })
const db = await welo.open(await welo.determine({ name: '1000' }))

const num = 1000
/**
 * write 1000 entries
 */
console.log(`writing ${num} entries`)
console.time(`wrote ${num} entries`)
let timeNew = Date.now()
let timeOld: number
for (let i = 0; i < num; i++) {
  if (i % 100 === 0) {
    console.log(`wrote ${i} entries`)
    timeOld = timeNew
    timeNew = Date.now()
    console.log(`wrote the last 100 entries in ${(timeNew - timeOld) / 1000} seconds`)
  }
  await db.replica.write({})
}
console.timeEnd(`wrote ${num} entries`)

/**
 * descending ordered traversal of entries
 */
console.log('descending traversal of ordered entries')
console.time('descending ordered traversal')
await db.replica.traverse({ direction: 'descend' })
console.timeEnd('descending ordered traversal')

/**
 * ascending ordered traversal of entries
 */
console.log('ascending traversal of ordered entries')
console.time('ascending ordered traversal')
await db.replica.traverse({ direction: 'ascend' })
console.timeEnd('ascending ordered traversal')

/**
 * unordered traversal of entries
 */
console.log('traversing unordered entries')
console.time('unordered traversal')
const { blocks, access, entry, Identity } = db.replica
const load = loadEntry({ blocks, entry, Identity })
const links = dagLinks({ graph: { has: (): boolean => false }, access })
await traverser({ cids: (await all(db.replica.heads.keys())).map(parsedcid), load, links })
console.timeEnd('unordered traversal')

await welo.stop()
await ipfs.stop()
