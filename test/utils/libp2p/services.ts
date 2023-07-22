
import { gossipsub, GossipSubComponents, GossipsubEvents } from '@chainsafe/libp2p-gossipsub'
import { kadDHT, type DualKadDHT, KadDHTComponents } from '@libp2p/kad-dht'
import { identifyService, IdentifyServiceComponents } from 'libp2p/identify'
import { ipnsSelector } from 'ipns/selector'
import { ipnsValidator } from 'ipns/validator'
import type { DefaultIdentifyService } from 'libp2p/identify/identify'
import type { PubSub } from '@libp2p/interface-pubsub'
import type { ServiceMap } from '@libp2p/interface-libp2p'

export interface AllServices extends ServiceMap {
  identify: DefaultIdentifyService
  pubsub: PubSub<GossipsubEvents>
  dht: DualKadDHT
}

export type UsedServices<K extends keyof AllServices> = Pick<AllServices, K>

export interface IdentifyService {
  (components: IdentifyServiceComponents): DefaultIdentifyService
}
export const getIdentifyService = (): IdentifyService => identifyService()

export interface PubsubService {
  (components: GossipSubComponents): PubSub<GossipsubEvents>
}
export const getPubsubService = (): PubsubService => gossipsub({
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
