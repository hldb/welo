import { cidstring } from '@/utils/index.js'
import { Playable } from '@/utils/playable.js'
import { HeadsExchange } from '@/utils/heads-exchange.js'
import { getHeads, addHeads } from '@/utils/replicator.js'
import { Config, ReplicatorModule, prefix } from '@/replicator/interface.js'
import type { GossipLibp2p } from '@/interface'
import type { DbComponents } from '@/interface.js'
import type { Manifest } from '@/manifest/index.js'
import type { Replica } from '@/replica/index.js'
import type { AccessInstance } from '@/access/interface.js'
import type { Stream, Connection } from '@libp2p/interface/connection'
import type { PeerInfo } from '@libp2p/interface/peer-info'
import type { PeerId } from '@libp2p/interface/peer-id'

export const protocol = `${prefix}he/1.0.0/` as const

export interface Options {
  peers: number
  timeout: number
  rounds: number
  collisionRate: number
  listenOnly: boolean
  reverseSync: boolean
  validate: boolean
}

export class BootstrapReplicator extends Playable {
  readonly libp2p: GossipLibp2p
  readonly manifest: Manifest
  readonly replica: Replica
  readonly access: AccessInstance
  readonly components: Pick<DbComponents, 'entry' | 'identity'>
  private readonly options: Options

  constructor ({ libp2p, replica }: Config & { libp2p: GossipLibp2p }, options: Partial<Options> = {}) {
    const starting = async (): Promise<void> => {
      // Handle direct head requests.
      await this.libp2p.handle(
        this.protocol,
        this.handle.bind(this) as (data: { stream: Stream, connection: Connection }) => void
      )

      // Bootstrap the heads
      if (!this.options.listenOnly) {
        (async () => {
          await this.bootstrap()
        })().catch(() => {})
      }
    }

    const stopping = async (): Promise<void> => {
      await this.libp2p.unhandle(this.protocol)
    }

    super({ starting, stopping })

    this.libp2p = libp2p 
    this.replica = replica
    this.manifest = replica.manifest
    this.access = replica.access
    this.components = replica.components

    this.options = {
      peers: options.peers ?? 5,
      timeout: options.timeout ?? 10000,
      rounds: options.rounds ?? 3,
      collisionRate: options.collisionRate ?? 0.10,
      listenOnly: options.listenOnly ?? false,
      reverseSync: options.reverseSync ?? true,
      validate: options.validate ?? true
    }
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

  private async handle ({ stream, connection }: { stream: Stream, connection: Connection }): Promise<void> {
    try {
      await this.exchange(stream, connection.remotePeer, this.options.reverseSync)
    } catch (error) {
      // Ignore
    }
  }

  private async bootstrap (): Promise<void> {
    const promises: Array<Promise<void>> = []

    for await (const peer of this.getPeers()) {
      if (peer.id.equals(this.libp2p.peerId)) {
        continue
      }

      promises.push(Promise.resolve().then(async () => {
        if (!await this.libp2p.peerStore.has(peer.id)) {
          await this.libp2p.peerStore.save(peer.id, peer)
        }

        // We need to dial so that libp2p can update multiaddrs.
        await this.libp2p.dial(peer.id)

        const stream = await this.libp2p.dialProtocol(peer.id, this.protocol)
        await this.exchange(stream, peer.id)
      }).catch(() => {}))
    }

    // Don't really care if individual head syncs fail.
    await Promise.allSettled(promises)
  }

  private async exchange (stream: Stream, remotePeerId: PeerId, reverseSync: boolean = true): Promise<void> {
    const heads = await getHeads(this.replica)
    const he = new HeadsExchange({
      stream,
      heads,
      remotePeerId,
      collisionRate: this.options.collisionRate,
      localPeerId: this.libp2p.peerId
    })

    // eslint-disable-next-line no-console
    const pipePromise = he.pipe().catch(console.error)

    if (!reverseSync) {
      await pipePromise
      he.close()
      await stream.close()
      return
    }

    try {
      for (let i = 0; i < this.options.rounds; i++) {
        const seed = i === 0 ? undefined : Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)
        const newHeads = await he.getHeads(seed)

        await addHeads(newHeads, this.replica, this.components)

        if (this.options.validate) {
          const matches = await he.verify()

          if (matches) {
            break
          }
        }
      }
    } catch (error) {
      // Ignore errors.
    }

    he.close()
    await stream.close()
  }
}

export const bootstrapReplicator: (libp2p: GossipLibp2p, options?: Partial<Options>) => ReplicatorModule<BootstrapReplicator, typeof protocol> = (libp2p, options: Partial<Options> = {}) => ({
  protocol,
  create: (config: Config) => new BootstrapReplicator({ ...config, libp2p }, options)
})
