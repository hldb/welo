/**
 * This is a slimmed down Bloom Filter based of:
 * https://github.com/Callidon/bloom-filters
 * https://github.com/fission-codes/bloom-filters
 */
import XXH from 'xxhashjs'

const uint8ToBits = (uint8: number): number[] => [128, 64, 32, 16, 8, 4, 2, 1].map(
  x => (x & uint8) > 0 ? 1 : 0
)

const bitsToUint8 = (bits: number[]): number => bits.reduce(
  (acc, cur, i) => cur === 0 ? acc : acc + Math.pow(2, 7 - i),
  0
)

const uint8ArrayToBuffer = (a: Uint8Array): ArrayBuffer => a.buffer.slice(a.byteOffset, a.byteLength + a.byteOffset)

const hashTwice = (value: Uint8Array, seed: number): [number, number] => [
  XXH.h64(uint8ArrayToBuffer(value), seed + 1).toNumber(),
  XXH.h64(uint8ArrayToBuffer(value), seed + 2).toNumber()
]

const getDistinctIndices = (element: Uint8Array, size: number, number: number, seed: number): number[] => {
  const indexes = new Set<number>()
  let n = 0
  let hashes = hashTwice(element, seed)

  while (indexes.size < number) {
    const ind = hashes[0] % size
    if (!indexes.has(ind)) {
      indexes.add(ind)
    }

    hashes[0] = (hashes[0] + hashes[1]) % size
    hashes[1] = (hashes[1] + n) % size
    n++

    if (n > size) {
      seed++
      hashes = hashTwice(element, seed)
    }
  }

  return [...indexes.values()]
}

export default class BloomFilter {
  public seed: number
  private readonly _size: number
  private readonly _nbHashes: number
  private _filter: number[]

  constructor (size: number, nbHashes: number, seed: number = 0x1111111111) {
    if (nbHashes < 1) {
      throw new Error('A Bloom Filter must have at least 2 hash functions.')
    }

    this.seed = seed
    this._size = size
    this._nbHashes = nbHashes
    this._filter = new Array<number>(this._size).fill(0)
  }

  static fromBytes (bytes: Uint8Array, nbHashes: number): BloomFilter {
    const bits = bytes.reduce((a, c) => a.concat(uint8ToBits(c)), [] as number[])
    const filter = new BloomFilter(bits.length, nbHashes)

    filter._filter = bits

    return filter
  }

  add (element: Uint8Array): void {
    const indexes = getDistinctIndices(element, this._size, this._nbHashes, this.seed)

    for (let i = 0; i < indexes.length; i++) {
      this._filter[indexes[i]] = 1
    }
  }

  has (element: Uint8Array): boolean {
    const indexes = getDistinctIndices(element, this._size, this._nbHashes, this.seed)

    for (let i = 0; i < indexes.length; i++) {
      if (this._filter[indexes[i]] == null || this._filter[indexes[i]] === 0) {
        return false
      }
    }

    return true
  }

  toBytes (): Uint8Array {
    const arr = new Uint8Array(Math.ceil(this._size / 8))

    for (let i = 0; i < arr.length; i++) {
      const bits = this._filter.slice(i * 8, i * 8 + 8)
      arr[i] = bitsToUint8(bits)
    }

    return arr
  }
}
