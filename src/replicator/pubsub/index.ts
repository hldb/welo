import { cidstring } from '@/utils/index.js'
import { Playable } from '@/utils/playable.js'
import { encodeHeads, decodeHeads, addHeads, getHeads } from '@/utils/replicator.js'
import { Config, ReplicatorModule, prefix } from '@/replicator/interface.js'
import type { GossipHelia } from '@/interface'
import type { DbComponents } from '@/interface.js'
import type { Manifest } from '@/manifest/index.js'
import type { Blocks } from '@/blocks/index.js'
import type { Replica } from '@/replica/index.js'
import type { AccessInstance } from '@/access/interface.js'
import type { Message } from '@libp2p/interface-pubsub'

export const protocol = `${prefix}pubsub/1.0.0/` as const

export class PubsubReplicator extends Playable {
  readonly ipfs: GossipHelia
  readonly manifest: Manifest
  readonly blocks: Blocks
  readonly replica: Replica
  readonly access: AccessInstance
  readonly components: Pick<DbComponents, 'entry' | 'identity'>

	private readonly onReplicaHeadsUpdate: typeof this.broadcast;
	private readonly onPubsubMessage: typeof this.parseHeads;

  constructor ({
    ipfs,
    replica,
    blocks
  }: Config) {
    const starting = async () => {
			this.replica.events.addEventListener('update', this.onReplicaHeadsUpdate)
			this.replica.events.addEventListener('write', this.onReplicaHeadsUpdate)

			this.pubsub.subscribe(this.protocol)
			this.pubsub.addEventListener("message", this.onPubsubMessage)
    }

    const stopping = async () => {
			this.replica.events.removeEventListener('update', this.onReplicaHeadsUpdate)
			this.replica.events.removeEventListener('write', this.onReplicaHeadsUpdate)

			this.pubsub.unsubscribe(this.protocol)
			this.pubsub.removeEventListener("message", this.onPubsubMessage)
    }

    super({ starting, stopping })

    this.ipfs = ipfs
    this.blocks = blocks
    this.replica = replica
    this.manifest = replica.manifest
    this.access = replica.access
    this.components = replica.components

		this.onReplicaHeadsUpdate = this.broadcast.bind(this);
		this.onPubsubMessage = this.parseHeads.bind(this);
  }

	private get libp2p () {
		return this.ipfs.libp2p;
	}

	private get pubsub () {
		return this.libp2p.services.pubsub;
	}

	private get protocol () {
		return `${protocol}${cidstring(this.manifest.address.cid)}`
	}

	private async parseHeads (evt: CustomEvent<Message>) {
		const heads = await decodeHeads(evt.detail.data);

		await addHeads(heads, this.replica, this.components)
	}

	private async encodeHeads (): Promise<Uint8Array> {
    const heads = await getHeads(this.replica)

		return await encodeHeads(heads);
	}

	private async broadcast () {
		this.pubsub.publish(this.protocol, await this.encodeHeads());
	}
}

export const pubsubReplicator: () => ReplicatorModule<PubsubReplicator, typeof protocol> = () => ({
  protocol,
  create: (config: Config) => new PubsubReplicator(config)
})
