import { DeferredPromise } from '@open-draft/deferred-promise'
import * as lp from 'it-length-prefixed'
import { pipe } from 'it-pipe'
import { type Pushable, pushable } from 'it-pushable'
import { CID } from 'multiformats/cid'
import { consume } from 'streaming-iterables'
import BloomFilter from './bloom-filter.js'
import type { Stream } from '@libp2p/interface/connection'
import type { PeerId } from '@libp2p/interface/peer-id'
import type { Uint8ArrayList } from 'uint8arraylist'
import { Message } from '@/message/heads.js'
import { hashHeads } from '@/utils/replicator.js'

const calculateFilterParams = (length: number, rate: number): { size: number, hashes: number } => {
  const safeLength = length <= 0 ? 1 : length
  const size = Math.ceil(-((safeLength * Math.log(rate)) / Math.pow(Math.log(2), 2)))
  const hashes = Math.ceil((size / safeLength) * Math.log(2))

  return { size, hashes }
}

const createFilter = (heads: CID[], options: Partial<{ collisionRate: number, seed: number }> = {}): { filter: BloomFilter, hashes: number } => {
  const { size, hashes } = calculateFilterParams(heads.length, options.collisionRate ?? 0.1)
  const filter = new BloomFilter(size, hashes, options.seed)

  for (const head of heads) {
    filter.add(head.bytes)
  }

  return { filter, hashes }
}

const generateSeed = (peerId1: PeerId, peerId2: PeerId): number => {
  const lastBytes1 = peerId1.toBytes().slice(-4).slice(2)
  const lastBytes2 = peerId2.toBytes().slice(-2)

  const seed = new Uint8Array([...lastBytes1, ...lastBytes2])

  return (
    seed[0] * 2 ** 24 +
    seed[1] * 2 ** 16 +
    seed[2] * 2 ** 8 +
    seed[3]
  )
}

const decodeMessage = async function * (source: Iterable<Uint8Array | Uint8ArrayList> | AsyncIterable<Uint8Array | Uint8ArrayList>): AsyncGenerator<Message> {
  for await (const message of source) {
    yield Message.decode(message)
  }
}

const encodeMessage = async function * (source: Iterable<Partial<Message>> | AsyncIterable<Partial<Message>>): AsyncGenerator<Uint8Array> {
  for await (const message of source) {
    yield Message.encode(message)
  }
}

enum MessageType {
  HEADS_REQUEST = 1,
  HEADS_RESPONSE = 2,
  VERIFY_REQUEST = 3,
  VERIFY_RESPONSE = 4
}

const getMessageType = (message: Partial<Message>): MessageType => {
  if (message.filter != null) {
    return MessageType.HEADS_REQUEST
  }

  if (message.hash != null) {
    return MessageType.VERIFY_REQUEST
  }

  if (message.match != null) {
    return MessageType.VERIFY_RESPONSE
  }

  return MessageType.HEADS_RESPONSE
}

export class HeadsExchange {
  private readonly stream: Stream
  private readonly heads: CID[]
  private readonly localSeed: number
  private readonly remoteSeed: number
  private readonly writer: Pushable<Partial<Message>> = pushable({ objectMode: true })
  private readonly collisionRate: number
  private verifyPromise: DeferredPromise<boolean> | null = null
  private headsPromise: DeferredPromise<CID[]> | null = null

  constructor (params: {
    stream: Stream
    heads: CID[]
    localPeerId: PeerId
    remotePeerId: PeerId
    collisionRate: number
  }) {
    this.stream = params.stream
    this.heads = params.heads
    this.localSeed = generateSeed(params.localPeerId, params.remotePeerId)
    this.remoteSeed = generateSeed(params.remotePeerId, params.localPeerId)
    this.collisionRate = params.collisionRate
  }

  async pipe (): Promise<void> {
    await Promise.all([
      pipe(
        this.writer,
        encodeMessage,
        lp.encode,
        this.stream
      ),
      pipe(
        this.stream,
        lp.decode,
        decodeMessage,
        (source) => this.handleMessage(source),
        (source) => this.send(source),
        consume
      )
    ])
  }

  close (): void {
    this.verifyPromise?.reject(new Error('exchange closed'))
    this.headsPromise?.reject(new Error('exchange closed'))
    this.writer.end()
  }

  async verify (): Promise<boolean> {
    if (this.stream.timeline.close != null) {
      throw new Error('stream is closed')
    }

    if (this.verifyPromise != null) {
      return this.verifyPromise
    }

    const hash = await hashHeads(this.heads)

    this.verifyPromise = new DeferredPromise()

    this.writer.push({
      hash: hash.bytes
    })

    return this.verifyPromise
  }

  async getHeads (seed?: number): Promise<CID[]> {
    if (this.stream.timeline.close != null) {
      throw new Error('stream is closed')
    }

    if (this.headsPromise != null) {
      return this.headsPromise
    }

    this.headsPromise = new DeferredPromise()

    const { filter, hashes } = createFilter(this.heads, {
      seed: this.localSeed,
      collisionRate: this.collisionRate
    })

    const message: Message['filter'] = {
      data: filter.toBytes(),
      hashes
    }

    if (seed != null) {
      message.seed = seed
    }

    this.writer.push({ filter: message })

    return this.headsPromise
  }

  private async * send (source: AsyncIterable<Partial<Message>>): AsyncGenerator<Partial<Message>> {
    for await (const message of source) {
      this.writer.push(message)
      yield message
    }
  }

  private async * handleMessage (source: AsyncIterable<Message>): AsyncGenerator<Partial<Message>> {
    for await (const message of source) {
      const type = getMessageType(message)

      switch (type) {
        case MessageType.HEADS_REQUEST:
          yield this.handleHeadsRequest(message)
          break
        case MessageType.HEADS_RESPONSE:
          this.handleHeadsResponse(message)
          break
        case MessageType.VERIFY_REQUEST:
          yield await this.handleVerifyRequest(message)
          break
        case MessageType.VERIFY_RESPONSE:
          this.handleVerifyResponse(message)
          break
        default:
          throw new Error('unexpected default case match')
      }
    }
  }

  private handleHeadsRequest (message: Message): Partial<Message> {
    if (message.filter == null) {
      throw new Error('invalid message')
    }

    const filter = BloomFilter.fromBytes(message.filter.data, message.filter.hashes)

    filter.seed = message.filter.seed ?? this.remoteSeed

    const missing = this.heads.map(h => h.bytes).filter(b => !filter.has(b))

    return { heads: missing }
  }

  private handleHeadsResponse (message: Message): void {
    if (message.heads == null) {
      throw new Error('invalid message')
    }

    const heads = message.heads.map(h => CID.decode(h))

    for (const head of heads) {
      this.heads.push(head)
    }

    this.headsPromise?.resolve(heads)
  }

  private async handleVerifyRequest (message: Message): Promise<Partial<Message>> {
    if (message.hash == null) {
      throw new Error('invalid message')
    }

    const localHash = await hashHeads(this.heads)
    const remoteHash = CID.decode(message.hash)
    const match = localHash.equals(remoteHash)

    if (this.verifyPromise == null) {
      this.verifyPromise = new DeferredPromise(resolve => { resolve(match) })
    } else {
      this.verifyPromise?.resolve(match)
    }

    return { match }
  }

  private handleVerifyResponse (message: Message): void {
    if (message.match == null) {
      throw new Error('invalid message')
    }

    this.verifyPromise?.resolve(message.match)
  }
}
