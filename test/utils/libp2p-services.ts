import { gossipsub } from '@chainsafe/libp2p-gossipsub'
import type { PubSub } from '@libp2p/interface/pubsub'
import { kadDHT, type DualKadDHT } from '@libp2p/kad-dht'
import { identify } from '@libp2p/identify'
import { ipnsSelector } from 'ipns/selector'
import { ipnsValidator } from 'ipns/validator'
import { keychain } from '@libp2p/keychain'
import type { ServiceMap } from '@libp2p/interface'
import type { Identify } from '@libp2p/identify'

export interface Services extends ServiceMap {
  identify: Identify
  pubsub: PubSub
  dht: DualKadDHT
}

export default {
  identify: identify(),
  pubsub: gossipsub({ emitSelf: true }),
  dht: kadDHT({
    clientMode: true,
    validators: { ipns: ipnsValidator },
    selectors: { ipns: ipnsSelector }
  }),
  keychain: keychain()
}
