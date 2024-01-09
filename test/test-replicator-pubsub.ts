import { type SetupComponents, setup, teardown, instanceSetup, liveReplicationTest, awaitPubsubJoin } from './utils/replicator.js'
import { pubsubReplicator, type PubsubReplicator } from '@/replicator/pubsub/index.js'

const testName = 'pubsub-replicator'

describe.skip(testName, () => {
  let components: SetupComponents<PubsubReplicator>

  before(async () => {
    components = await setup(testName, pubsubReplicator())
  })

  after(async () => {
    await teardown(components)
  })

  describe('instance', () => {
    before(async () => {
      await Promise.all([
        instanceSetup(components),
        awaitPubsubJoin(components, components.replicator1.topic)
      ])
    })

    it('replicates replica entries and identities', async () => {
      await liveReplicationTest(components)
    })
  })
})
