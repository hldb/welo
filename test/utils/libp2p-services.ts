
import { gossipsub, type GossipSub } from '@chainsafe/libp2p-gossipsub'
import { kadDHT, type DualKadDHT } from '@libp2p/kad-dht'
import { identifyService } from 'libp2p/identify'
import { ipnsSelector } from 'ipns/selector'
import { ipnsValidator } from 'ipns/validator'
import type { ServiceMap } from '@libp2p/interface'
import type { DefaultIdentifyService } from 'libp2p/identify/identify'

export interface Services extends ServiceMap {
  identify: DefaultIdentifyService
  pubsub: GossipSub
  dht: DualKadDHT
}

export default {
  identify: identifyService(),
  pubsub: gossipsub({ emitSelf: true }),
  dht: kadDHT({
    clientMode: true,
    validators: { ipns: ipnsValidator },
    selectors: { ipns: ipnsSelector }
  })
}
