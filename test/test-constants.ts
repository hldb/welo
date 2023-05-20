import { assert } from './utils/chai.js'

import * as constants from '@/utils/constants.js'

describe('Constants', () => {
  it('exports WELO_PATH', () => {
    assert.strictEqual(constants.WELO_PATH, '/welo')
  })

  it('exports OPALSNT_PREFIX', () => {
    assert.strictEqual(constants.OPALSNT_PREFIX, '/hldb/')
  })
})
