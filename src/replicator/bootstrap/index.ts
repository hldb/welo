import { pipe } from 'it-pipe'
import concat from 'it-concat'
import { cidstring } from '@/utils/index.js'
import { Playable } from '@/utils/playable.js'
import { encodeHeads, decodeHeads, addHeads, getHeads } from '@/utils/replicator.js'
import { Config, ReplicatorModule, prefix } from '@/replicator/interface.js'
import type { GossipHelia, GossipLibp2p } from '@/interface'
import type { DbComponents } from '@/interface.js'
import type { Manifest } from '@/manifest/index.js'
import type { Blocks } from '@/blocks/index.js'
import type { Replica } from '@/replica/index.js'
import type { AccessInstance } from '@/access/interface.js'
import type { Stream } from '@libp2p/interface-connection'
import type { PeerInfo } from '@libp2p/interface-peer-info'

export const protocol = `${prefix}bootstrap/1.0.0/` as const

export interface Options {
  peers: number
  timeout: number
}

export class BootstrapReplicator extends Playable {
  readonly ipfs: GossipHelia
  readonly manifest: Manifest
  readonly blocks: Blocks
  readonly replica: Replica
  readonly access: AccessInstance
  readonly components: Pick<DbComponents, 'entry' | 'identity'>
  private readonly options: Options

  constructor ({ ipfs, replica, blocks }: Config, options: Partial<Options> = {}) {
    const starting = async (): Promise<void> => {
      // Handle direct head requests.
      await this.libp2p.handle(
        this.protocol,
        this.handle.bind(this) as ({ stream }: { stream: Stream }) => void
      );

      // Bootstrap the heads
      (async () => {
        await this.bootstrap()
      })().catch(() => {})
    }

    const stopping = async (): Promise<void> => {
      await this.libp2p.unhandle(this.protocol)
    }

    super({ starting, stopping })

    this.ipfs = ipfs
    this.blocks = blocks
    this.replica = replica
    this.manifest = replica.manifest
    this.access = replica.access
    this.components = replica.components

    this.options = {
      peers: options.peers ?? 5,
      timeout: options.timeout ?? 10000
    }
  }

  private get libp2p (): GossipLibp2p {
    return this.ipfs.libp2p
  }

  private get protocol (): string {
    return `${protocol}${cidstring(this.manifest.address.cid)}`
  }

  private async * getPeers (): AsyncGenerator<PeerInfo> {
    const itr = this.libp2p.contentRouting.findProviders(this.manifest.address.cid, {
      signal: AbortSignal.timeout(this.options.timeout)
    })

    try {
      let i = 0

      for await (const peer of itr) {
        if (i >= this.options.peers) {
          break
        }

        yield peer

        i++
      }
    } catch (error) {
      // Ignore errors.
    }
  }

  private async parseHeads (message: Uint8Array): Promise<void> {
    const heads = await decodeHeads(message)

    await addHeads(heads, this.replica, this.components)
  }

  private async encodeHeads (): Promise<Uint8Array> {
    const heads = await getHeads(this.replica)

    return await encodeHeads(heads)
  }

  private async handle ({ stream }: { stream: Stream }): Promise<void> {
    await pipe([await this.encodeHeads()], stream)
  }

  private async bootstrap (): Promise<void> {
    const promises: Array<Promise<void>> = []

    for await (const peer of this.getPeers()) {
      if (peer.id.equals(this.libp2p.peerId)) {
        continue
      }

      promises.push(Promise.resolve().then(async () => {
        await this.libp2p.peerStore.save(peer.id, peer)

        const stream = await this.libp2p.dialProtocol(peer.id, this.protocol)
        const responses = await pipe(stream, async itr => await concat(itr, { type: 'buffer' }))

        await this.parseHeads(responses.subarray())
      }))
    }

    // Don't really care if individual head syncs fail.
    await Promise.allSettled(promises)
  }
}

export const bootstrapReplicator: (options?: Partial<Options>) => ReplicatorModule<BootstrapReplicator, typeof protocol> = (options: Partial<Options> = {}) => ({
  protocol,
  create: (config: Config) => new BootstrapReplicator(config, options)
})
