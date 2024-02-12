import { assert } from 'aegir/chai'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import BloomFilter from '../src/utils/bloom-filter.js'

const testData = [
  uint8ArrayFromString('test-1'),
  uint8ArrayFromString('test-2'),
  uint8ArrayFromString('test-3'),
  uint8ArrayFromString('abc123'),
  uint8ArrayFromString('A very long uint8array..........'),
  uint8ArrayFromString(''),
  uint8ArrayFromString('1'),
  uint8ArrayFromString('a'),
  uint8ArrayFromString('b'),
  uint8ArrayFromString('c')
]

describe('bloom filter', () => {
  it('creates a filter with the specified seed', () => {
    const seed = 0x123456789
    const filter = new BloomFilter(2, 2, seed)

    assert.equal(filter.seed, seed)
  })

  it('the has method returns false on an empty filter', () => {
    const filter = new BloomFilter(2, 2)

    for (const data of testData) {
      assert.isFalse(filter.has(data))
    }
  })

  it('the has method returns true if it has that element', () => {
    const filter = new BloomFilter(20, 4)

    for (const data of testData) {
      filter.add(data)
    }

    for (const data of testData) {
      assert.isTrue(filter.has(data))
    }
  })

  it('the has method returns true only on elements that are contained in a partial filter', () => {
    const filter = new BloomFilter(20, 4)

    for (let i = 0; i < testData.length / 2; i++) {
      filter.add(testData[i])
    }

    for (let i = 0; i < testData.length; i++) {
      if (i < testData.length / 2) {
        assert.isTrue(filter.has(testData[i]))
      } else {
        assert.isFalse(filter.has(testData[i]))
      }
    }
  })

  it('encodes the filter', () => {
    const filter = new BloomFilter(20, 4)

    for (const data of testData) {
      filter.add(data)
    }

    const f = filter.toBytes()

    assert.isOk(f)
  })

  it('decodes the filter', () => {
    const nbHashes = 4
    const filter = new BloomFilter(20, nbHashes)

    for (const data of testData) {
      filter.add(data)
    }

    const f = filter.toBytes()

    const filter2 = BloomFilter.fromBytes(f, nbHashes)

    assert.deepEqual(filter2.toBytes(), filter.toBytes())
  })
})
