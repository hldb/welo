import { strict as assert } from 'assert'

import * as constants from '~utils/constants.js'

describe('Constants', () => {
  it('exports WELO_LOWER', () => {
    assert.equal(constants.WELO_LOWER, 'welo')
  })

  it('exports OPALSNT_PREFIX', () => {
    assert.equal(constants.WELO_PATH, '/welo')
  })
})
