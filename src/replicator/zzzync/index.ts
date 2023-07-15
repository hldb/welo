import type { Web3Storage } from 'web3.storage'
import W3NameService from 'w3name/service'
import { zzzync, type Zzzync, toDcid } from '@tabcat/zzzync'
import { w3name as namer, revisionState, type RevisionState } from '@tabcat/zzzync/namers/w3name'
import { dht as advertiser, CreateEphemeralLibp2p, Libp2pWithDHT } from '@tabcat/zzzync/advertisers/dht'
import { CID } from 'multiformats/cid'
import { CarReader } from '@ipld/car/reader'
import { CarWriter } from '@ipld/car/writer'
import { createEd25519PeerId } from '@libp2p/peer-id-factory'
import { peerIdFromBytes } from '@libp2p/peer-id'

import { Playable } from '@/utils/playable.js'
import type { Replica } from '@/replica/index.js'
import { Blocks } from '@/blocks/index.js'

import protocol from './protocol.js'
import type { Config, ReplicatorModule } from '../interface.js'
import type { Ed25519PeerId } from '@libp2p/interface-peer-id'
import { Paily } from '@/utils/paily.js'
import type { Blockstore } from 'interface-blockstore'
import { entries } from '@alanshaw/pail'
import { ShardBlockView, ShardFetcher, ShardLink } from '@alanshaw/pail/shard'
import { Datastore, Key } from 'interface-datastore'
// import { CodeError } from '@libp2p/interfaces/errors'
import type { AnyBlock, BlockFetcher } from '@alanshaw/pail/block'
import type { AnyLink } from '@alanshaw/pail/link'
import type { SignedEntry } from '@/entry/basal'
import type { EntryInstance } from '@/entry/interface'
// import { parsedcid } from '@/utils/index.js'
// import all from 'it-all'
import drain from 'it-drain'

const ipfsNamespace = '/ipfs/'
const republishInterval = 1000 * 60 * 60 * 10 // 10 hours in milliseconds
const providerKey = new Key('provider')

export class ZzzyncReplicator extends Playable {
  readonly replica: Replica
  readonly datastore: Datastore
  readonly blockstore: Blockstore
  readonly blocks: Blocks
  dcid: CID | null

  readonly w3: Required<W3>
  #zync: Zzzync
  #provider: Ed25519PeerId | null
  #revisions: RevisionState
  #lastAdvertised: number

  constructor ({ replica, blocks, ipfs, datastore, blockstore, provider, options }: Config & { options: Options }) {
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
    this.blocks = blocks
    this.datastore = datastore
    this.blockstore = blockstore
    this.dcid = null

    this.w3 = { name: new W3NameService(), ...options.w3 }

    this.#revisions = options.revisions ?? revisionState(datastore)
    this.#lastAdvertised = 0

    const libp2p = ipfs.libp2p as unknown as Libp2pWithDHT

    this.#zync = zzzync(
      namer(this.w3.name, this.#revisions),
      advertiser(libp2p, options.createEphemeralLibp2p, { scope: options.scope })
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

    const { writer, out } = CarWriter.create(root as CID)
    const reader = CarReader.fromIterable(out)

    const shardFetcher = new ShardFetcher(this.replica.graph.nodes.blockFetcher)
    for await (const shard of traverseShards(shardFetcher, await shardFetcher.get(root))) {
      await writer.put(shard)
    }

    for await (const [k, v] of entries(this.replica.graph.nodes.blockFetcher, root)) {
      const entry = await this.replica.components.entry.fetch({
        blocks: this.blocks,
        identity: this.replica.components.identity,
        cid: CID.parse(new Key(k).baseNamespace())
      })
      await writer.put(entry.block)
      await writer.put(entry.identity.block)

      const block = await this.replica.graph.nodes.blockFetcher.get(v)
      if (block != null) {
        await writer.put({ cid: v as CID, bytes: block.bytes })
      }

      console.log({
        root: root.toString(),
        k: k.toString(),
        v: v.toString(),
        entry: entry.cid.toString(),
        identity: entry.identity.auth.toString()
      })
    }

    await writer.close()

    // @ts-expect-error - w3client uses old @ipld/car and CID versions
    await this.w3.client.putCar(await reader)

    await this.#zync.namer.publish(this.#provider, root as CID)

    const now = Date.now()
    if (now > (this.#lastAdvertised + republishInterval)) {
      await drain(this.#zync.advertiser.collaborate(this.dcid, this.#provider))
      this.#lastAdvertised = now
    }
  }

  async download (): Promise<void> {
    if (this.dcid == null) {
      throw new Error('dcid required. is ZzzyncReplicator started?')
    }

    const providers: Map<string, Ed25519PeerId> = new Map()
    for await (const event of this.#zync.advertiser.findCollaborators(this.dcid)) {
      if (
        event.name === 'PROVIDER' ||
        (event.name === 'PEER_RESPONSE' && event.messageName === 'GET_PROVIDERS')
      ) {
        for (const provider of event.providers) {
          if (provider.id.type !== 'Ed25519') {
            continue
          }
          const peerIdString = provider.id.toString()
          !providers.has(peerIdString) && providers.set(peerIdString, provider.id)
        }
        // findProviders hangs
        break
      }
    }

    const fetchEntry = async (cid: CID): Promise<EntryInstance<SignedEntry>> => {
      const response = await this.w3.client.get(cid.toString())

      if (response?.status !== 200) {
        throw new Error('base response fetching entry')
      }

      const arrayBuffer = await response.arrayBuffer()
      const reader = await CarReader.fromBytes(new Uint8Array(arrayBuffer))
      const block = await Blocks.decode<SignedEntry>({ bytes: reader._blocks[0].bytes })
      const identity = this.replica.components.identity.asIdentity({
        block: await Blocks.decode({ bytes: reader._blocks[1].bytes })
      })

      if (identity == null) {
        throw new Error('identity was null')
      }

      const entry = await this.replica.components.entry.asEntry({ block, identity })

      if (entry == null) {
        throw new Error('entry was null')
      }

      return entry as EntryInstance<SignedEntry>
    }

    const resolveAndFetch = async (peerId: Ed25519PeerId): Promise<void> => {
      let value: ShardLink
      try {
        value = await this.#zync.namer.resolve(peerId) as ShardLink
      } catch (e) {
        console.error(e)
        return
      }

      const diff = await this.replica.graph.nodes.diff(value, { blockFetcher: w3storageBlockFetcher(this.w3.client) })

      const promises: Array<Promise<EntryInstance<SignedEntry>>> = []
      for (const [k, v] of diff.keys) {
        if (v[1] != null) {
          continue
        }

        promises.push(fetchEntry(CID.parse(new Key(k).baseNamespace())))
      }
      await Promise.all(promises).then(async entries => await this.replica.add(entries))
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

interface W3 {
  client: Web3Storage
  name?: W3NameService
}
interface Options {
  w3: W3
  revisions?: RevisionState
  createEphemeralLibp2p: CreateEphemeralLibp2p
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
