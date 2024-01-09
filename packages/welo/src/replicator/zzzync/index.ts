import { type Zzzync, toDcid, Pinner } from '@tabcat/zzzync'
import { CID } from 'multiformats/cid'
import { CarReader } from '@ipld/car/reader'
import { CarWriter } from '@ipld/car/writer'

import { Playable } from '@/utils/playable.js'
import type { Replica } from '@/replica/index.js'

import protocol from './protocol.js'
import type { Config, ReplicatorModule } from '../interface.js'
import type { Ed25519PeerId } from '@libp2p/interface/peer-id'
import { Paily } from '@/utils/paily.js'
import type { Blockstore } from 'interface-blockstore'
import { entries as pailEntries } from '@alanshaw/pail'
import { ShardBlockView, ShardFetcher, ShardLink } from '@alanshaw/pail/shard'
import { Datastore, Key } from 'interface-datastore'
import type { AnyBlock, BlockFetcher } from '@alanshaw/pail/block'
import type { AnyLink } from '@alanshaw/pail/link'
import type { SignedEntry } from '@/entry/basal'
import type { EntryInstance } from '@/entry/interface'
import { decodeCbor, encodeCbor } from '@/utils/block.js'

const republishInterval = 1000 * 60 * 60 * 10 // 10 hours in milliseconds

export class ZzzyncReplicator extends Playable {
  readonly replica: Replica
  readonly datastore: Datastore
  readonly blockstore: Blockstore
  dcid: CID | null

  #zzzync: Zzzync
  #provider: Ed25519PeerId
  #lastAdvertised: number

  constructor ({ replica, peerId, datastore, blockstore, zzzync }: Config & { zzzync: Zzzync }) {
    const starting = async (): Promise<void> => {
      this.dcid = await toDcid(replica.manifest.block.cid)
    }
    const stopping = async (): Promise<void> => {}
    super({ starting, stopping })

    this.replica = replica
    this.datastore = datastore
    this.blockstore = blockstore
    this.dcid = null

    this.#lastAdvertised = 0

    this.#zzzync = zzzync
    this.#provider = peerId
  }

  async upload (): Promise<void> {
    if (this.dcid == null) {
      throw new Error('dcid required. is ZzzyncReplicator started?')
    }
    if (this.replica.graph.nodes.root == null) {
      throw new Error('replica not started')
    }

    let cid: ShardLink | null
    try {
      cid = await this.#zzzync.namer.resolve(this.#provider) as ShardLink
    } catch (e) {
      console.error(e)
      cid = null
    }

    const root = this.replica.graph.nodes.root

    let oldRoot: ShardLink
    if (cid == null) {
      oldRoot = await Paily.create(this.blockstore).then(paily => paily.root)
    } else {
      oldRoot = cid
    }

    if (root.equals(oldRoot)) {
      return
    }

    const replicaBlocks: Array<{ cid: CID, bytes: Uint8Array }> = []
    const shardFetcher = new ShardFetcher(this.replica.graph.nodes.blockFetcher)
    for await (const shard of traverseShards(shardFetcher, await shardFetcher.get(root))) {
      replicaBlocks.push(shard)
    }

    for await (const [k, v] of pailEntries(this.replica.graph.nodes.blockFetcher, root)) {
      const entry = await this.replica.components.entry.fetch({
        blockstore: this.blockstore,
        identity: this.replica.components.identity,
        cid: CID.parse(new Key(k).baseNamespace())
      })
      replicaBlocks.push(entry.block)
      replicaBlocks.push(entry.identity.block)

      const block = await this.replica.graph.nodes.blockFetcher.get(v)
      if (block != null) {
        replicaBlocks.push({ cid: v as CID, bytes: block.bytes })
      }
    }

    const rootBlock = await encodeCbor(replicaBlocks.map(({ cid }) => cid))

    const { writer, out } = CarWriter.create(rootBlock.cid)
    const reader = CarReader.fromIterable(out)

    await writer.put(rootBlock)
    for (const block of replicaBlocks) {
      await writer.put(block)
    }

    await writer.close()

    // @ts-expect-error - w3client uses old @ipld/car and CID versions
    await this.w3.client.putCar(await reader)

    await this.#zzzync.namer.publish(this.#provider, root as CID)

    const now = Date.now()
    if (now > (this.#lastAdvertised + republishInterval)) {
      await this.#zzzync.advertiser.collaborate(this.dcid, this.#provider)
      this.#lastAdvertised = now
    }
  }

  async download (): Promise<void> {
    if (this.dcid == null) {
      throw new Error('dcid required. is ZzzyncReplicator started?')
    }

    const providers: Map<string, Ed25519PeerId> = new Map()
    for await (const provider of this.#zzzync.advertiser.findCollaborators(this.dcid)) {
      if (provider.type !== 'Ed25519') {
        continue
      }
      const peerIdString = provider.toString()
      !providers.has(peerIdString) && providers.set(peerIdString, provider)
      // findProviders hangs
      break
    }


    const fetchEntry = async (cid: CID): Promise<EntryInstance<SignedEntry>> => {
      const bytes = await this.#zzzync.pinner.get(cid)  
      const block = await decodeCbor<SignedEntry>(bytes)

      const identity = this.replica.components.identity.asIdentity({
        block: await decodeCbor(await this.#zzzync.pinner.get(block.value.auth))
      })


      if (identity == null) {
        throw new Error('identity was null')
      }

      const entry = await this.replica.components.entry.asEntry({ block, identity })

      return entry as EntryInstance<SignedEntry>
    }

    const resolveAndFetch = async (peerId: Ed25519PeerId): Promise<void> => {
      let value: ShardLink
      try {
        value = await this.#zzzync.namer.resolve(peerId) as ShardLink
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e)
        return
      }

      const diff = await this.replica.graph.nodes.diff(
        value,
        { blockFetchers: [w3storageBlockFetcher(this.#zzzync.pinner)] }
      )

      const promises: Array<Promise<EntryInstance<SignedEntry>>> = []
      for (const [k, v] of diff.keys) {
        if (v[0] === null) {
          promises.push(fetchEntry(CID.parse(new Key(k).baseNamespace())))
        }
      }
      await Promise.all(promises).then(async entries => { await this.replica.add(entries) })
    }

    const promises: Array<Promise<unknown>> = []
    for (const provider of providers.values()) {
      promises.push(resolveAndFetch(provider))
    }
    await Promise.all(promises)
  }
}

export const w3storageBlockFetcher = (pinner: Pinner): BlockFetcher => ({
  get: async (link: AnyLink): Promise<AnyBlock | undefined> => {
    try {
      return { cid: link, bytes: await pinner.get(link as CID) }
    } catch (e) {
      return undefined
    }
  }
})

export const carBlockFetcher = (car: CarReader): BlockFetcher => ({
  get: async (link: AnyLink): Promise<AnyBlock | undefined> => {
    return await car.get(link as CID)
  }
})

export const zzzyncReplicator: (zzzync: Zzzync) => ReplicatorModule<ZzzyncReplicator, typeof protocol> =
(zzzync) => ({
  protocol,
  create: (config: Config) => new ZzzyncReplicator({ ...config, zzzync })
})

async function * traverseShards (shards: ShardFetcher, shard: ShardBlockView): AsyncIterable<ShardBlockView> {
  yield shard
  for (const [k, v] of shard.value) {
    if (Array.isArray(v)) {
      yield * traverseShards(shards, await shards.get(v[0], shard.prefix + k))
    }
  }
}
