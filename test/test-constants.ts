import { strict as assert } from 'assert'

import * as constants from '~utils/constants.js'

describe('Constants', () => {
  it('exports OPAL_LOWER', () => {
    assert.equal(constants.OPAL_LOWER, 'opal')
  })

  it('exports OPAL_PREFIX', () => {
    assert.equal(constants.OPAL_PREFIX, '/opal')
  })
})
