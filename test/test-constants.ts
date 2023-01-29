import { strict as assert } from 'assert'

import * as constants from '~utils/constants.js'

describe('Constants', () => {
  it('exports WELO_PATH', () => {
    assert.equal(constants.WELO_PATH, '/welo')
  })

  it('exports OPALSNT_PREFIX', () => {
    assert.equal(constants.OPALSNT_PREFIX, '/hldb/')
  })
})
