import EventEmitter from 'events'
import all from 'it-all'
import { IPFS } from 'ipfs-core-types'
import { start, stop } from '@libp2p/interfaces/dist/src/startable'
import { CID } from 'multiformats/cid'
import { Message } from '@libp2p/interface-pubsub'
import { PeerId } from '@libp2p/interface-peer-id'

import * as ReplicatorMessage from './message.js'
import { DirectChannel } from '../utils/pubsub/direct.js'
import { SharedChannel } from '../utils/pubsub/shared.js'
import { dagLinks, loadEntry, traverser } from '../../database/traversal.js'
import { Playable } from '../../utils/playable.js'
import { Manifest } from '../../manifest/default/index.js'
import { Blocks } from '../../blocks/index.js'
import { EntryStatic } from '../../entry/interface.js'
import { IdentityStatic } from '../../identity/interface.js'
import { Replica } from '../../database/replica.js'
import { AccessInstance } from '../../access/interface.js'
import { parsedcid } from '../../utils/index.js'
import { base32 } from 'multiformats/bases/base32.js'

// const timeout = 30000

export class LiveReplicator extends Playable {
  readonly ipfs: IPFS
  readonly localPeerId: PeerId
  readonly manifest: Manifest
  readonly blocks: Blocks
  readonly replica: Replica
  readonly access: AccessInstance
  readonly Entry: EntryStatic<any>
  readonly Identity: IdentityStatic<any>

  readonly shared: SharedChannel
  readonly directs: Map<string, DirectChannel>

  readonly events: EventEmitter

  constructor ({
    ipfs,
    peerId,
    manifest,
    blocks,
    replica,
    access,
    Entry,
    Identity
  }: {
    ipfs: IPFS
    peerId: PeerId
    manifest: Manifest
    blocks: Blocks
    replica: Replica
    access: AccessInstance
    Entry: EntryStatic<any>
    Identity: IdentityStatic<any>
  }) {
    const starting = async (): Promise<void> => {
      this.shared.monitor.on('peer-join', this._onPeerJoin) // join the direct channel topic for that peer and wait for them to join
      this.shared.monitor.on('peer-leave', this._onPeerLeave) // if a peer leaves and the direct connection is closed then delete the direct

      await start(this.shared)

      this.replica.events.on('update', this._onReplicaHeadsUpdate)
      this.replica.events.on('write', this._onReplicaHeadsUpdate)
    }
    const stopping = async (): Promise<void> => {
      this.replica.events.removeListener('update', this._onReplicaHeadsUpdate)
      this.replica.events.removeListener('write', this._onReplicaHeadsUpdate)

      this.shared.monitor.removeListener('peer-join', this._onPeerJoin)
      this.shared.monitor.removeListener('peer-leave', this._onPeerLeave)

      await stop(...this.directs.values())

      await stop(this.shared)
    }
    super({ starting, stopping })

    this.ipfs = ipfs
    this.localPeerId = peerId
    this.manifest = manifest
    this.blocks = blocks
    this.replica = replica
    this.access = access
    this.Entry = Entry
    this.Identity = Identity

    this.events = new EventEmitter()

    this.shared = new SharedChannel(this.ipfs, this.manifest.address)
    this.directs = new Map()
  }

  async broadcast (heads: CID[]): Promise<void> {
    const promises: Array<Promise<void>> = []
    for (const direct of this.directs.values()) {
      if (direct.isOpen()) {
        promises.push(direct.publish(heads))
      }
    }

    await Promise.all(promises)
  }

  _onReplicaHeadsUpdate (): void {
    void all(this.replica.heads.keys())
      .then(heads => { void this.broadcast(Array.from(heads).map(parsedcid)) })
  }

  _onHeadsMessage (msg: Message): void {
    void (async () => {
      const message = await ReplicatorMessage.read(msg.data)
      const cids = message.value.heads

      const load = loadEntry({
        blocks: this.blocks,
        Entry: this.Entry,
        Identity: this.Identity
      })
      const links = dagLinks({
        graph: this.replica.graph,
        access: this.access
      })

      await this.replica.add(await traverser({ cids, load, links }))
    })()
  }

  // may need to queue _onPeer* so start and stop arent called concurrently, or check for that in Direct

  _onPeerJoin (remotePeerId: PeerId): void {
    const direct = new DirectChannel(this.ipfs, this.manifest.address, this.localPeerId, remotePeerId)
    this.directs.set(remotePeerId.toCID().toString(base32), direct)
    void start(direct)
  }

  _onPeerLeave (remotePeerId: PeerId): void {
    // if direct exists in this.directs Map then .delete returns true
    const key = remotePeerId.toCID().toString(base32)
    const direct = this.directs.get(key)
    void stop(direct)
    this.directs.delete(key)
  }
}
