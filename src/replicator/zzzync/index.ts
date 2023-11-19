import type { Web3Storage } from 'web3.storage'
import type { Libp2p } from '@libp2p/interface'
import W3NameService from 'w3name/service'
import { zzzync, type Zzzync, toDcid } from '@tabcat/zzzync'
import { w3Namer as namer, revisionState, type RevisionState } from '@tabcat/zzzync/namers/w3'
import { dhtAdvertiser as advertiser, CreateEphemeralKadDHT } from '@tabcat/zzzync/advertisers/dht'
import { CID } from 'multiformats/cid'
import { CarReader } from '@ipld/car/reader'
import { CarWriter } from '@ipld/car/writer'
import { createEd25519PeerId } from '@libp2p/peer-id-factory'
import { peerIdFromBytes } from '@libp2p/peer-id'

import { Playable } from '@/utils/playable.js'
import type { Replica } from '@/replica/index.js'

import protocol from './protocol.js'
import type { Config, ReplicatorModule } from '../interface.js'
import type { Ed25519PeerId } from '@libp2p/interface-peer-id'
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

const ipfsNamespace = '/ipfs/'
const republishInterval = 1000 * 60 * 60 * 10 // 10 hours in milliseconds
const providerKey = new Key('provider')

export class ZzzyncReplicator extends Playable {
  readonly replica: Replica
  readonly datastore: Datastore
  readonly blockstore: Blockstore
  dcid: CID | null

  readonly w3: Required<W3>
  #zync: Zzzync
  #provider: Ed25519PeerId | null
  #revisions: RevisionState
  #lastAdvertised: number

  constructor ({ replica, ipfs, datastore, blockstore, provider, options }: Config & { options: Options }) {
    if (options.createEphemeralLibp2p == null) {
      throw new Error('need createEphemeralLibp2p function to be supplied')
    }

    if (ipfs.libp2p.services.dht == null) {
      throw new Error('zzzync replicator needs the dht')
    }

    const starting = async (): Promise<void> => {
      this.dcid = await toDcid(replica.manifest.block.cid)
      try {
        if (provider != null) {
          this.#provider = provider
        } else {
          const bytes = await datastore.get(providerKey)
          this.#provider = peerIdFromBytes(bytes) as Ed25519PeerId
        }
      } catch (e: any) {
        if (e.code === 'ERR_NOT_FOUND') {
          this.#provider = await createEd25519PeerId()
          await datastore.put(providerKey, this.#provider.toBytes())
        } else {
          throw e
        }
      }
    }
    const stopping = async (): Promise<void> => {}
    super({ starting, stopping })

    this.replica = replica
    this.datastore = datastore
    this.blockstore = blockstore
    this.dcid = null

    this.w3 = { name: new W3NameService(), ...options.w3 }

    this.#revisions = options.revisions ?? revisionState(datastore)
    this.#lastAdvertised = 0

    const libp2p = ipfs.libp2p as unknown as Libp2p<Awaited<ReturnType<CreateEphemeralKadDHT>>>

    this.#zync = zzzync(
      namer(this.w3.name, this.#revisions),
      advertiser(libp2p.services.dht, options.createEphemeralLibp2p),
      ipfs.blockstore
    )

    this.#provider = null
  }

  async upload (): Promise<void> {
    if (this.#provider == null) {
      throw new Error('provider required. is ZzzyncReplicator started?')
    }
    if (this.dcid == null) {
      throw new Error('dcid required. is ZzzyncReplicator started?')
    }
    if (this.replica.graph.nodes.root == null) {
      throw new Error('replica not started')
    }

    const revision = await this.#revisions.get(this.#provider)

    const root = this.replica.graph.nodes.root

    let oldRoot: ShardLink
    if (revision == null) {
      oldRoot = await Paily.create(this.blockstore).then(paily => paily.root)
    } else {
      if (!revision.value.startsWith(ipfsNamespace)) {
        throw new Error('invalid revision value, value does not start with "/ipfs/"')
      }

      oldRoot = CID.parse(revision.value.slice(ipfsNamespace.length))
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

    await this.#zync.namer.publish(this.#provider, root as CID)

    const now = Date.now()
    if (now > (this.#lastAdvertised + republishInterval)) {
      await this.#zync.advertiser.collaborate(this.dcid, this.#provider)
      this.#lastAdvertised = now
    }
  }

  async download (): Promise<void> {
    if (this.dcid == null) {
      throw new Error('dcid required. is ZzzyncReplicator started?')
    }

    const providers: Map<string, Ed25519PeerId> = new Map()
    for await (const provider of this.#zync.advertiser.findCollaborators(this.dcid)) {
      if (provider.type !== 'Ed25519') {
        continue
      }
      const peerIdString = provider.toString()
      !providers.has(peerIdString) && providers.set(peerIdString, provider)
      // findProviders hangs
      break
    }

    const fetchEntry = async (cid: CID): Promise<EntryInstance<SignedEntry>> => {
      const response = await this.w3.client.get(cid.toString())

      if (response?.status !== 200) {
        throw new Error('base response fetching entry')
      }

      const arrayBuffer = await response.arrayBuffer()
      const reader = await CarReader.fromBytes(new Uint8Array(arrayBuffer))
      const block = await decodeCbor<SignedEntry>(reader._blocks[0].bytes)
      const identity = this.replica.components.identity.asIdentity({
        block: await decodeCbor(reader._blocks[1].bytes)
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
        value = await this.#zync.namer.resolve(peerId) as ShardLink
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e)
        return
      }

      const response = await this.w3.client.get(value.toString())

      if (response?.status !== 200) {
        throw new Error(response?.statusText ?? 'bad response from w3')
      }

      const reader = await CarReader.fromBytes(new Uint8Array(await response.arrayBuffer()))

      const diff = await this.replica.graph.nodes.diff(
        value,
        { blockFetchers: [w3storageBlockFetcher(this.w3.client), carBlockFetcher(reader)] }
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

export const w3storageBlockFetcher = (client: Web3Storage): BlockFetcher => ({
  get: async (link: AnyLink): Promise<AnyBlock | undefined> => {
    const response = await client.get(link.toString())

    if (response?.status === 200) {
      const carBytes = new Uint8Array(await response.arrayBuffer())
      const reader = await CarReader.fromBytes(carBytes)

      return await reader.get(link as CID)
    }

    return undefined
  }
})

export const carBlockFetcher = (car: CarReader): BlockFetcher => ({
  get: async (link: AnyLink): Promise<AnyBlock | undefined> => {
    return await car.get(link as CID)
  }
})

interface W3 {
  client: Web3Storage
  name?: W3NameService
}
interface Options {
  w3: W3
  revisions?: RevisionState
  createEphemeralLibp2p: CreateEphemeralKadDHT
  scope?: 'lan' | 'wan'
}

export const zzzyncReplicator: (options: Options) => ReplicatorModule<ZzzyncReplicator, typeof protocol> =
(options) => ({
  protocol,
  create: (config: Config) => new ZzzyncReplicator({ ...config, options })
})

async function * traverseShards (shards: ShardFetcher, shard: ShardBlockView): AsyncIterable<ShardBlockView> {
  yield shard
  for (const [k, v] of shard.value) {
    if (Array.isArray(v)) {
      yield * traverseShards(shards, await shards.get(v[0], shard.prefix + k))
    }
  }
}
