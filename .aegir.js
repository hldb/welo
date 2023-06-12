import { readFileSync } from 'node:fs';


/** @type {import('aegir').PartialOptions} */
export default {
  test: {
    before: async (options) => {
      let token = null

      if (typeof process.env.W3_TOKEN === 'string' && process.env.W3_TOKEN.length > 0) {
        token = process.env.W3_TOKEN
      } else {
        try {
          token = readFileSync('.w3_token', { encoding: 'utf-8'}).split('\n')[0]
        } catch {}
      }
      

      return {
        env: {
          W3_TOKEN: null ?? token
        }
      }
    },
    after: async (options, beforeResult) => {
    }
  }
}