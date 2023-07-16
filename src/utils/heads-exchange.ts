import { CID } from 'multiformats/cid'
import { DeferredPromise } from '@open-draft/deferred-promise'
import { BloomFilter } from 'fission-bloom-filters'
import { getHeads, addHeads, hashHeads } from '@/utils/replicator.js'
import { Message } from '@/message/heads.js'
import type { Replica } from '@/replica/index.js'
import type { PeerId } from '@libp2p/interface-peer-id'
import type { Stream } from '@libp2p/interface-connection'
import type { DbComponents } from '@/interface.js'
import { pipe } from 'it-pipe'
import * as lp from 'it-length-prefixed'
import { pushable, Pushable } from 'it-pushable'
import type { Uint8ArrayList } from 'uint8arraylist'

const calculateFilterParams = (length: number, rate: number): { size: number, hashes: number }  => {
	const size = Math.ceil(-((length * Math.log(rate)) / Math.pow(Math.log(2), 2)))
	const hashes = Math.ceil((size / length) * Math.log(2))

	return { size, hashes }
}

const createFilter = (heads: CID[], options: Partial<{ errorRate: number, seed: number }> = {}): { filter: BloomFilter, hashes: number } => {
	const { size, hashes } = calculateFilterParams(heads.length, options.errorRate ?? 0.1)
	const filter = new BloomFilter(size, hashes)

	if (options.seed != null) {
		filter.seed = options.seed
	}

	for (const head of heads) {
		filter.add(head.bytes)
	}

	return { filter, hashes }
}

const generateSeed = (peerId: PeerId, round: number = 0): number => {
	const bytes = peerId.toBytes().slice((round + 1) * -4).slice(4)

	return (
		bytes[0] * 2**24 +
		bytes[1] * 2**16 +
		bytes[2] * 2**8 +
		bytes[3]
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
	private readonly localPeerId: PeerId
	private readonly remotePeerId: PeerId
	private readonly writer: Pushable<Partial<Message>> = pushable({ objectMode: true })
	private verifyPromise: DeferredPromise<boolean> | null = null
	private headsPromise: DeferredPromise<CID[]> | null = null

	constructor (stream: Stream, localPeerId: PeerId, remotePeerId: PeerId) {
		this.stream = stream
		this.heads = []
		this.localPeerId = localPeerId
		this.remotePeerId = remotePeerId
	}

	async start () {
		pipe(
			this.writer,
			encodeMessage,
			lp.encode,
			this.stream,
			lp.decode,
			decodeMessage,
			(source) => this.handleMessage(source),
			encodeMessage,
			lp.encode,
			this.stream
		)
	}

	async verify (): Promise<boolean> {
		if (this.verifyPromise != null) {
			return await this.verifyPromise
		}

		const hash = await hashHeads(this.heads)

		this.verifyPromise = new DeferredPromise()

		this.writer.push({
			hash: hash.bytes
		})

		return await this.verifyPromise
	}

	async getHeads (): Promise<CID[]> {
		if (this.headsPromise != null) {
			return await this.headsPromise
		}

		this.headsPromise = new DeferredPromise()

		const seed = generateSeed(this.remotePeerId)
		const { filter, hashes } = createFilter(this.heads, { seed })

		this.writer.push({
			filter: {
				data: filter.toBytes(),
				hashes
			}
		})

		return await this.headsPromise
	}

	async close () {

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
			}
		}
	}

	private handleHeadsRequest (message: Message): Partial<Message> {
		if (message.filter == null) {
			throw new Error('invalid message')
		}

		const filter = BloomFilter.fromBytes(message.filter.data, message.filter.hashes)

		filter.seed = message.filter.seed ?? generateSeed(this.localPeerId)

		const missing = this.heads.map(h => h.bytes).filter(b => !filter.has(b))

		return { heads: missing }
	}

	private handleHeadsResponse (message: Message): void {
		if (message.heads == null) {
			throw new Error('invalid message')
		}

		const heads = message.heads.map(h => CID.decode(h))

		this.headsPromise?.resolve(heads)
	}

	private async handleVerifyRequest (message: Message): Promise<Partial<Message>> {
		if (message.hash == null) {
			throw new Error('invalid message')
		}

		const localHash = await hashHeads(this.heads)
		const remoteHash = CID.decode(message.hash)

		return {
			match: localHash.equals(remoteHash)
		}
	}

	private handleVerifyResponse (message: Message): void {
		if (message.match == null) {
			throw new Error('invalid message')
		}

		this.verifyPromise?.resolve(message.match)
	}
}
