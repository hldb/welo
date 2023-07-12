import all from 'it-all'
//import { start, stop } from '@libp2p/interfaces/startable'
import { base32 } from 'multiformats/bases/base32'
import type { GossipHelia } from '@/interface'
import type { CID } from 'multiformats/cid'
import type { Message } from '@libp2p/interface-pubsub'
import * as lp from 'it-length-prefixed'
import { pipe } from 'it-pipe'
import { take } from 'streaming-iterables'
import { toString as uint8ArrayToString, fromString as uint8ArrayFromString } from "uint8arrays";

import { dagLinks, loadEntry, traverser } from '@/replica/traversal.js'
import { cidstring, parsedcid } from '@/utils/index.js'
import { Playable } from '@/utils/playable.js'
import { Direct } from '@/pubsub/direct.js'
import type { DbComponents } from '@/interface.js'
import type { Manifest } from '@/manifest/index.js'
import type { Blocks } from '@/blocks/index.js'
import type { Replica } from '@/replica/index.js'
import type { AccessInstance } from '@/access/interface.js'

import type { Config, ReplicatorModule } from '../interface.js'
import * as Advert from './message.js'
import protocol from './protocol.js'

const getSharedChannelTopic = (manifest: Manifest): string => `${protocol}${cidstring(manifest.address.cid)}`

export class LiveReplicator extends Playable {
  readonly ipfs: GossipHelia
  readonly manifest: Manifest
  readonly blocks: Blocks
  readonly replica: Replica
  readonly access: AccessInstance
  readonly components: Pick<DbComponents, 'entry' | 'identity'>

	private readonly onReplicaHeadsUpdate: typeof this.broadcast;

  constructor ({
    ipfs,
    replica,
    blocks
  }: Config) {
    const starting = async (): Promise<void> => {
			// Handle direct head requests.
			await this.libp2p.handle(protocol, async data => {
				const heads = await this.getHeads();

				await pipe(data.stream, lp.decode, function * () {
					yield heads;
				}, lp.encode, data.stream);
			});

			// Bootstrap the heads
			for await (const peer of this.peers) {
				// We don't care about peers that don't support our protocol.
				if (!peer.protocols.includes(protocol)) {
					continue
				}

				await this.libp2p.peerStore.save(peer.id, peer)

				const stream = await this.libp2p.dialProtocol(peer.id, protocol)
				const encoded = uint8ArrayFromString("get")
				const responses = await pipe([encoded], lp.encode, stream, lp.decode, take(1), all) as  [Uint8Array];

				await this.addHeads(responses[0]);
			}

			this.replica.events.addEventListener('update', this.onReplicaHeadsUpdate)
			this.replica.events.addEventListener('write', this.onReplicaHeadsUpdate)
    }

    const stopping = async (): Promise<void> => {
			await this.libp2p.unhandle(protocol);

			this.replica.events.removeEventListener('update', this.onReplicaHeadsUpdate)
			this.replica.events.removeEventListener('write', this.onReplicaHeadsUpdate)
    }

    super({ starting, stopping })

    this.ipfs = ipfs
    this.blocks = blocks
    this.replica = replica
    this.manifest = replica.manifest
    this.access = replica.access
    this.components = replica.components

		this.onReplicaHeadsUpdate = () => this.broadcast();
  }

	private get libp2p () {
		return this.ipfs.libp2p;
	}

	private get pubsub () {
		return this.libp2p.services.pubsub;
	}

	private get peers () {
		return this.ipfs.libp2p.contentRouting.findProviders(this.manifest.address.cid)
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

	private broadcast () {

	}
}

export const liveReplicator: () => ReplicatorModule<LiveReplicator, typeof protocol> = () => ({
  protocol,
  create: (config: Config) => new LiveReplicator(config)
})
