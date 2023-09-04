import { assert } from 'aegir/chai'

import * as constants from '@/utils/constants.js'

describe('Constants', () => {
  it('exports WELO_PATH', () => {
    assert.strictEqual(constants.WELO_PATH, '/welo')
  })

  it('exports HLDB_PREFIX', () => {
    assert.strictEqual(constants.HLDB_PREFIX, '/hldb/')
  })
})
