import all from 'it-all'
import type { GossipHelia } from '@/interface'
import type { CID } from 'multiformats/cid'
import { dagLinks, loadEntry, traverser } from '@/replica/traversal.js'
import { cidstring, parsedcid } from '@/utils/index.js'
import { Playable } from '@/utils/playable.js'
import type { DbComponents } from '@/interface.js'
import type { Manifest } from '@/manifest/index.js'
import type { Blocks } from '@/blocks/index.js'
import type { Replica } from '@/replica/index.js'
import type { AccessInstance } from '@/access/interface.js'
import type { Message } from '@libp2p/interface-pubsub'

import type { Config, ReplicatorModule } from '../interface.js'
import * as Advert from './message.js'
import protocol from './protocol.js'

export class PubsubReplicator extends Playable {
  readonly ipfs: GossipHelia
  readonly manifest: Manifest
  readonly blocks: Blocks
  readonly replica: Replica
  readonly access: AccessInstance
  readonly components: Pick<DbComponents, 'entry' | 'identity'>

	private readonly onReplicaHeadsUpdate: typeof this.broadcast;
	private readonly onPubsubMessage: (evt: CustomEvent<Message>) => Promise<void>;

  constructor ({
    ipfs,
    replica,
    blocks
  }: Config) {
    const starting = async (): Promise<void> => {
			this.replica.events.addEventListener('update', this.onReplicaHeadsUpdate)
			this.replica.events.addEventListener('write', this.onReplicaHeadsUpdate)

			this.pubsub.subscribe(this.protocol)
			this.pubsub.addEventListener("message", this.onPubsubMessage)
    }

    const stopping = async (): Promise<void> => {
			this.pubsub.unsubscribe(this.protocol)

			this.replica.events.removeEventListener('update', this.onReplicaHeadsUpdate)
			this.replica.events.removeEventListener('write', this.onReplicaHeadsUpdate)

			this.pubsub.removeEventListener("message", this.onPubsubMessage)
    }

    super({ starting, stopping })

    this.ipfs = ipfs
    this.blocks = blocks
    this.replica = replica
    this.manifest = replica.manifest
    this.access = replica.access
    this.components = replica.components

		this.onReplicaHeadsUpdate = () => this.broadcast();
		this.onPubsubMessage = (evt: CustomEvent<Message>) => {
			return this.addHeads(evt.detail.data)
		};
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

	private async addHeads (message: Uint8Array) {
    const advert = await Advert.read(message)
    const cids = advert.value.heads

    const load = loadEntry({
      blocks: this.blocks,
      entry: this.components.entry,
      identity: this.components.identity
    })

    const links = dagLinks({
      graph: this.replica.graph,
      access: this.access
    })

    const traversed = await traverser({ cids, load, links })
    await this.replica.add(traversed)
	}

	private async getHeads (): Promise<Uint8Array> {
    const heads: CID[] = Array.from(await all(this.replica.heads.queryKeys({})))
      .map(key => parsedcid(key.baseNamespace()))

    const advert = await Advert.write(this.manifest.address.cid, heads)

		return advert.bytes;
	}

	private async broadcast () {
		this.pubsub.publish(this.protocol, await this.getHeads());
	}
}

export const pubsubReplicator: () => ReplicatorModule<PubsubReplicator, typeof protocol> = () => ({
  protocol,
  create: (config: Config) => new PubsubReplicator(config)
})
