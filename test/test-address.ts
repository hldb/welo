import { assert } from './utils/chai.js'
import { CID } from 'multiformats/cid'

import { Address } from '~manifest/address.js'

describe('Address', () => {
  let address: Address
  const prefix = '/hldb/'
  const hash = 'bafyreiewienqflf5skie6c5xlmasqj7ndj24qwt6fxkwqdwzggfmpdmqai'
  const string = prefix + hash

  describe('Class', () => {
    it('exposes class properties', () => {
      assert.isOk(Address.asAddress)
    })

    describe('.asAddress', () => {
      it('returns an address from a cid', () => {
        address = Address.asAddress({ cid: CID.parse(hash) }) as Address
        assert.strictEqual(address.toString(), string)
      })

      it('returns the same instance if possible', () => {
        const _address = Address.asAddress(address)
        assert.strictEqual(_address, address)
      })

      it('returns null if unable to coerce', () => {
        assert.strictEqual(Address.asAddress(), null)
        assert.strictEqual(Address.asAddress(''), null)
        assert.strictEqual(Address.asAddress({ cid: hash }), null)
      })
    })

    describe('.fromString', () => {
      it('returns address from string', () => {
        address = Address.fromString(string)
        assert.strictEqual(address.cid.toString(), hash)
      })

      it('throws given invalid string', () => {
        assert.throws(() => Address.fromString(''))
        assert.throws(() => Address.fromString(prefix))
        assert.throws(() => Address.fromString(hash))
      })
    })
  })

  describe('Instance', () => {
    it('exposes instance properties', () => {
      assert.strictEqual(address.toString(), string)
    })

    it('.toString', () => {
      assert.strictEqual(address.toString(), string)
    })

    describe('.equals', () => {
      it('returns true if the addresses are the same', () => {
        const _address = Address.fromString(string)
        assert.isOk(address.equals(address))
        assert.isOk(address.equals(_address))
      })

      it('returns false if the addresses are different', () => {
        const _hash =
          'bafyreib2caa6txg46uhpt43bgfnfk3wzfdbz4n2frn2brbrjtjuambgd6i'
        const _address = Address.fromString(prefix + _hash)
        assert.strictEqual(address.equals(_address), false)
      })
    })
  })
})
