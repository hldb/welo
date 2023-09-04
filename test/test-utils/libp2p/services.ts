
import { gossipsub, GossipSubComponents, GossipsubEvents } from '@chainsafe/libp2p-gossipsub'
import { kadDHT, type DualKadDHT, KadDHTComponents } from '@libp2p/kad-dht'
import { IdentifyService, identifyService, IdentifyServiceComponents } from 'libp2p/identify'
import { ipnsSelector } from 'ipns/selector'
import { ipnsValidator } from 'ipns/validator'
import type { PubSub } from '@libp2p/interface/pubsub'
import type { ServiceMap } from '@libp2p/interface'

export interface AllServices extends ServiceMap {
  identify: IdentifyService
  pubsub: PubSub<GossipsubEvents>
  dht: DualKadDHT
}

export type UsedServices<K extends keyof AllServices> = Pick<AllServices, K>

export const getIdentifyService = (): (components: IdentifyServiceComponents) => IdentifyService =>
  identifyService()

export const getPubsubService = (): (components: GossipSubComponents) => PubSub<GossipsubEvents> =>
  gossipsub({
    emitSelf: true,
    allowPublishToZeroPeers: true
  })

export interface DhtService {
  (components: KadDHTComponents): DualKadDHT
}
export const getDhtService = (clientMode: boolean): ReturnType<typeof kadDHT> => kadDHT({
  clientMode,
  validators: { ipns: ipnsValidator },
  selectors: { ipns: ipnsSelector }
})
