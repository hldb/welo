import { assert } from 'aegir/chai'
import { type SetupComponents, setup, teardown, instanceSetup, liveReplicationTest } from './utils/replicator.js'
import { liveReplicator, type LiveReplicator } from '@/replicator/live/index.js'

const testName = 'live-replicator'

describe.skip(testName, () => {
  let components: SetupComponents<LiveReplicator>

  before(async () => {
    components = await setup(testName, liveReplicator())
  })

  after(async () => {
    await teardown(components)
  })

  describe('instance', () => {
    it('exposes instance properties', () => {
      assert.isOk(components.replicator1.broadcast)
    })

    before(async () => {
      await instanceSetup(components)
    })

    it('replicates replica entries and identities', async () => {
      await liveReplicationTest(components)
    })
  })
})
