import EventEmitter from 'events'
import all from 'it-all'
import { start, stop } from '@libp2p/interfaces/startable'
import { base32 } from 'multiformats/bases/base32'
import type { IPFS } from 'ipfs-core-types'
import type { Libp2p } from 'libp2p'
import type { CID } from 'multiformats/cid'
import type { Message, PublishResult } from '@libp2p/interface-pubsub'
import type { PeerId } from '@libp2p/interface-peer-id'

import { dagLinks, loadEntry, traverser } from '~database/traversal.js'
import { cidstring, parsedcid } from '~utils/index.js'
import { Playable } from '~utils/playable.js'
import { Monitor } from '~pubsub/monitor.js'
import { Direct } from '~pubsub/direct.js'
import type { Manifest } from '~manifest/index.js'
import type { Blocks } from '~blocks/index.js'
import type { EntryStatic } from '~entry/interface.js'
import type { IdentityStatic } from '~identity/interface.js'
import type { Replica } from '~database/replica.js'
import type { AccessInstance } from '~access/interface.js'
import type { Registrant } from '~registry/registrant.js'

import * as Advert from './message.js'
import { protocol } from './protocol.js'

const getSharedChannelTopic = (manifest: Manifest): string => '/opal/replicator/live/1.0.0/' + cidstring(manifest.address.cid)

export class LiveReplicator extends Playable implements Registrant {
  readonly ipfs: IPFS
  readonly libp2p: Libp2p
  readonly manifest: Manifest
  readonly blocks: Blocks
  readonly replica: Replica
  readonly access: AccessInstance
  readonly Entry: EntryStatic<any>
  readonly Identity: IdentityStatic<any>

  readonly shared: Monitor
  readonly directs: Map<string, Direct>

  readonly events: EventEmitter
  readonly #onPeerJoin: typeof onPeerJoin
  readonly #onPeersLeave: typeof onPeersLeave
  readonly #onReplicaHeadsUpdate: typeof onReplicaHeadsUpdate
  readonly _onHeadsMessage: typeof onHeadsMessage

  get protocol (): typeof protocol {
    return protocol
  }

  constructor ({
    ipfs,
    libp2p,
    manifest,
    blocks,
    replica,
    access,
    Entry,
    Identity
  }: {
    ipfs: IPFS
    libp2p: Libp2p
    manifest: Manifest
    blocks: Blocks
    replica: Replica
    access: AccessInstance
    Entry: EntryStatic<any>
    Identity: IdentityStatic<any>
  }) {
    const starting = async (): Promise<void> => {
      this.shared.on('peer-join', this.#onPeerJoin) // join the direct channel topic for that peer and wait for them to join
      this.shared.on('peer-leave', this.#onPeersLeave) // if a peer leaves and the direct connection is closed then delete the direct

      this.replica.events.on('update', this.#onReplicaHeadsUpdate)
      this.replica.events.on('write', this.#onReplicaHeadsUpdate)

      await start(this.shared)
    }
    const stopping = async (): Promise<void> => {
      this.replica.events.removeListener('update', this.#onReplicaHeadsUpdate)
      this.replica.events.removeListener('write', this.#onReplicaHeadsUpdate)

      this.shared.removeListener('peer-join', this.#onPeerJoin)
      this.shared.removeListener('peer-leave', this.#onPeersLeave)

      await stop(...this.directs.values())

      await stop(this.shared)
    }
    super({ starting, stopping })

    this.ipfs = ipfs
    this.libp2p = libp2p
    this.manifest = manifest
    this.blocks = blocks
    this.replica = replica
    this.access = access
    this.Entry = Entry
    this.Identity = Identity

    this.events = new EventEmitter()
    this.#onPeerJoin = onPeerJoin.bind(this)
    this.#onPeersLeave = onPeersLeave.bind(this)
    this.#onReplicaHeadsUpdate = onReplicaHeadsUpdate.bind(this)
    this._onHeadsMessage = onHeadsMessage.bind(this)

    this.shared = new Monitor(this.libp2p, getSharedChannelTopic(this.manifest))
    this.directs = new Map()
  }

  async broadcast (): Promise<void> {
    if (Array.from(await all(this.replica.heads.values())).length < 1) {
      return
    }
    const heads: CID[] = Array.from(await all(this.replica.heads.keys())).map(parsedcid)

    const promises: Array<Promise<PublishResult>> = []
    const advert = await Advert.write(this.manifest.address.cid, heads)
    for (const direct of this.directs.values()) {
      if (direct.isOpen()) {
        promises.push(direct.publish(advert.bytes))
      }
    }

    await Promise.all(promises)
  }
}

function onReplicaHeadsUpdate (this: LiveReplicator): void {
  void this.broadcast()
}

function onHeadsMessage (this: LiveReplicator, evt: CustomEvent<Message>): void {
  void (async () => {
    const msg = evt.detail
    const message = await Advert.read(msg.data)
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

    const traversed = await traverser({ cids, load, links })
    await this.replica.add(traversed)
  })()
}

function onPeerJoin (this: LiveReplicator, remotePeerId: PeerId): void {
  const direct = new Direct(
    this.libp2p,
    remotePeerId
  )
  direct.once('peered', () => { void this.broadcast() })
  direct.on('message', this._onHeadsMessage)
  this.directs.set(remotePeerId.toCID().toString(base32), direct)
  void start(direct)
}

function onPeersLeave (this: LiveReplicator, remotePeerId: PeerId): void {
  // if direct exists in this.directs Map then .delete returns true
  const key = remotePeerId.toCID().toString(base32)
  const direct = this.directs.get(key)
  if (direct != null) {
    direct.removeListener('message', this._onHeadsMessage)
    void stop(direct)
    this.directs.delete(key)
  }
}
