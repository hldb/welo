import { CID } from 'multiformats/cid'
import { BloomFilter } from 'fission-bloom-filters'
import { getHeads, addHeads, hashHeads } from '@/utils/replicator.js'
import { Message } from '@/message/heads.js'
import type { Replica } from '@/replica/index.js'
import type { PeerId } from '@libp2p/interface-peer-id'
import type { Stream } from '@libp2p/interface-connection'
import type { DbComponents } from '@/interface.js'
import { pipe } from 'it-pipe'
import * as lp from 'it-length-prefixed'
import type { Uint8ArrayList } from 'uint8arraylist'
import Crypto from 'crypto'

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

const handleFilter = (
	message: NonNullable<Message['filter']>,
	localPeerId: PeerId,
	heads: CID[]
): Partial<Message> => {
	const filter = BloomFilter.fromBytes(message.data, message.hashes)

	filter.seed = message.seed ?? generateSeed(localPeerId)

	const missing = heads.map(h => h.bytes).filter(b => !filter.has(b))

	return { heads: missing }
}

const handleHeads = async (
	message: NonNullable<Message['heads']>,
	replica: Replica,
	components: Pick<DbComponents, 'entry' | 'identity'>,
	heads: CID[]
): Promise<Partial<Message>> => {

	const remoteHeads = message.map(h => CID.decode(h))

	await addHeads(remoteHeads, replica, components)

	for (const head of remoteHeads) {
		heads.push(head)
	}

	const localHash = await hashHeads(heads)

	return { hash: localHash.bytes }
}

const handleHash = async (
	message: NonNullable<Message['hash']>,
	heads: CID[]
): Promise<boolean> => {
	const remoteHash = CID.decode(message)
	const localHash = await hashHeads(heads)

	return remoteHash.equals(localHash)
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

const performSyncRound = async function * (
	source: Iterable<Message> | AsyncIterable<Message>,
	replica: Replica,
	localPeerId: PeerId,
	components: Pick<DbComponents, 'entry' | 'identity'>,
	seed: number
): AsyncGenerator<Partial<Message> | boolean> {
	const heads = await getHeads(replica)
	const { filter, hashes } = createFilter(heads, { seed })

	// Send the filter immediately.
	yield {
		filter: {
			data: filter.toBytes(),
			hashes
		}
	}

	for await (const message of source) {
		if (message.filter != null) {
			yield handleFilter(message.filter, localPeerId, heads)

			continue
		}

		if (message.hash != null) {
			yield await handleHash(message.hash, heads)
			return
		}

		yield await handleHeads(message.heads, replica, components, heads)
	}

	throw new Error('aborted')
}

export const exchange = async (
	stream: Stream,
	replica: Replica,
	remotePeerId: PeerId,
	localPeerId: PeerId,
	components: Pick<DbComponents, 'entry' | 'identity'>
) => {
	const ROUNDS = 5;
	let seed = generateSeed(remotePeerId)

	await pipe(stream, lp.decode, decodeMessage, async function * (source) {
		for (let i = 0; i < ROUNDS; i ++) {
			const syncItr = performSyncRound(source, replica, localPeerId, components, seed)

			for await (const message of syncItr) {
				if (typeof message !== "boolean") {
					yield message
				} else if (message === true) {
					return
				} else {
					break
				}
			}

			seed = Crypto.randomInt(0, Number.MAX_SAFE_INTEGER)
		}
	}, encodeMessage, lp.encode, stream)
}
