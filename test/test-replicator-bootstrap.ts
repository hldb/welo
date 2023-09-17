import { assert } from './utils/chai.js'
import { start } from '@libp2p/interfaces/startable'
import { bootstrapReplicator, BootstrapReplicator } from '@/replicator/bootstrap/index.js'
import { SetupComponents, setup, teardown } from './utils/replicator.js'
import { isBrowser } from 'wherearewe'

const testName = 'bootstrap-replicator'

let _describe: Mocha.SuiteFunction | Mocha.PendingSuiteFunction
if (isBrowser) {
  console.log('no web3.storage token found at .w3_token. skipping zzzync replicator tests')
  _describe = describe.skip
} else {
  _describe = describe
}

_describe(testName, () => {
  let components: SetupComponents<BootstrapReplicator>

  before(async () => {
    components = await setup(testName, bootstrapReplicator({ reverseSync: false }))
  })

  after(async () => {
    await teardown(components)
  })

  describe('instance', () => {
    it('replicates replica entries and identities on startup', async () => {
      await start(components.replicator1)

      await components.replica1.write(new Uint8Array())

      const updatePromise = new Promise(resolve => {
        components.replica2.events.addEventListener('update', resolve, { once: true })
      })

      await Promise.all([
        components.libp2p1.dial(components.addr2),
        new Promise(resolve => components.libp2p2.addEventListener('peer:connect', resolve, { once: true }))
      ])

      await start(components.replicator2)

      await updatePromise

      if (components.replica1.root == null || components.replica2.root == null) {
        throw new Error('replica root is null')
      }

      assert.equal(components.replica1.root.toString(), components.replica2.root.toString())
    })
  })
})
