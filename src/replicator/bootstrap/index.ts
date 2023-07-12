import { pipe } from 'it-pipe'
import concat from 'it-concat'
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
import type { Stream } from '@libp2p/interface-connection'

export const protocol = `${prefix}bootstrap/1.0.0/` as const

export class BootstrapReplicator extends Playable {
  readonly ipfs: GossipHelia
  readonly manifest: Manifest
  readonly blocks: Blocks
  readonly replica: Replica
  readonly access: AccessInstance
  readonly components: Pick<DbComponents, 'entry' | 'identity'>

  constructor ({
    ipfs,
    replica,
    blocks
  }: Config) {
    const starting = async (): Promise<void> => {
			// Handle direct head requests.
			await this.libp2p.handle(this.protocol, data => this.handle(data));

			// Bootstrap the heads
			await this.bootstrap()
    }

    const stopping = async (): Promise<void> => {
			await this.libp2p.unhandle(this.protocol);
    }

    super({ starting, stopping })

    this.ipfs = ipfs
    this.blocks = blocks
    this.replica = replica
    this.manifest = replica.manifest
    this.access = replica.access
    this.components = replica.components
  }

	private get libp2p () {
		return this.ipfs.libp2p;
	}

	private get protocol () {
		return `${protocol}${cidstring(this.manifest.address.cid)}`
	}

	private async * getPeers () {
		const itr = this.libp2p.contentRouting.findProviders(this.manifest.address.cid, {
			signal: AbortSignal.timeout(1000)
		});

		try {
			for await (const peer of itr) {
				yield peer;
			}
		} catch (error) {
			// Ignore errors.
		}
	}

	private async parseHeads (message: Uint8Array) {
		const heads = await decodeHeads(message);

		await addHeads(heads, {
			replica: this.replica,
			access: this.access,
			blocks: this.blocks,
			...this.components
		})
	}

	private async encodeHeads () {
    const heads = await getHeads(this.replica, this.manifest)

		return await encodeHeads(heads);
	}

	private async handle ({ stream }: { stream: Stream }) {
		await pipe([await this.encodeHeads()], stream);
	}

	private async bootstrap () {
		const promises: Promise<void>[] = [];

		for await (const peer of this.getPeers()) {
			if (peer.id.equals(this.libp2p.peerId)) {
				continue
			}

			promises.push(Promise.resolve().then(async () => {
				await this.libp2p.peerStore.save(peer.id, peer)

				const stream = await this.libp2p.dialProtocol(peer.id, this.protocol)
				const responses = await pipe(stream, itr => concat(itr, { type: "buffer" }))

				await this.parseHeads(responses.subarray());
			}))
		}

		// Don't really care if individual head syncs fail.
		await Promise.allSettled(promises)
	}
}

export const bootstrapReplicator: () => ReplicatorModule<BootstrapReplicator, typeof protocol> = () => ({
  protocol,
  create: (config: Config) => new BootstrapReplicator(config)
})
