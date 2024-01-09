import { cidstring } from '@/utils/index.js'
import { Playable } from '@/utils/playable.js'
import { addHeads } from '@/utils/replicator.js'
import { Config, ReplicatorModule, prefix } from '@/replicator/interface.js'
import { CID } from 'multiformats/cid'
import type { DbComponents } from '@/interface.js'
import type { Manifest } from '@/manifest/index.js'
import type { Replica, ReplicaEvents } from '@/replica/index.js'
import type { AccessInstance } from '@/access/interface.js'
import type { Message, PubSub } from '@libp2p/interface/pubsub'

export const protocol = `${prefix}pubsub/1.0.0/` as const

export class PubsubReplicator extends Playable {
  readonly pubsub: PubSub
  readonly manifest: Manifest
  readonly replica: Replica
  readonly access: AccessInstance
  readonly components: Pick<DbComponents, 'entry' | 'identity'>

  private readonly onReplicaHeadsUpdate: (evt: ReplicaEvents['write']) => void
  private readonly onPubsubMessage: (evt: CustomEvent<Message>) => void

  constructor ({
    pubsub,
    replica
  }: Config & { pubsub: PubSub }) {
    const starting = async (): Promise<void> => {
      this.replica.events.addEventListener('write', this.onReplicaHeadsUpdate)

      this.pubsub.subscribe(this.topic)
      this.pubsub.addEventListener('message', this.onPubsubMessage)
    }

    const stopping = async (): Promise<void> => {
      this.replica.events.removeEventListener('write', this.onReplicaHeadsUpdate)

      this.pubsub.unsubscribe(this.topic)
      this.pubsub.removeEventListener('message', this.onPubsubMessage)
    }

    super({ starting, stopping })

    this.pubsub = pubsub
    this.replica = replica
    this.manifest = replica.manifest
    this.access = replica.access
    this.components = replica.components

    this.onReplicaHeadsUpdate = this.broadcast.bind(this) as (evt: ReplicaEvents['write']) => void
    this.onPubsubMessage = this.parseHead.bind(this) as (evt: CustomEvent<Message>) => void
  }

  get topic (): string {
    return `${protocol}${cidstring(this.manifest.address.cid)}`
  }

  private async parseHead (evt: CustomEvent<Message>): Promise<void> {
    const head = CID.decode(evt.detail.data)

    await addHeads([head], this.replica, this.components)
  }

  private async broadcast (evt: ReplicaEvents['write']): Promise<void> {
    await this.pubsub.publish(this.topic, evt.detail.cid.bytes)
  }
}

export const pubsubReplicator: (pubsub: PubSub) => ReplicatorModule<PubsubReplicator, typeof protocol> = (pubsub) => ({
  protocol,
  create: (config: Config) => new PubsubReplicator({ ...config, pubsub })
})
