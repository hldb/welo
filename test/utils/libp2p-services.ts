import { gossipsub } from '@chainsafe/libp2p-gossipsub'
import { identify } from '@libp2p/identify'
import { kadDHT, type KadDHT } from '@libp2p/kad-dht'
import { keychain, type Keychain } from '@libp2p/keychain'
import { ipnsSelector } from 'ipns/selector'
import { ipnsValidator } from 'ipns/validator'
import type { Identify } from '@libp2p/identify'
import type { ServiceMap } from '@libp2p/interface'
import type { PubSub } from '@libp2p/interface/pubsub'

export interface Services extends ServiceMap {
  identify: Identify
  pubsub: PubSub
  dht: KadDHT
  keychain: Keychain
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
