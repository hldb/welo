import { readFileSync } from 'node:fs'
import { Libp2p, createLibp2p } from 'libp2p'
import { getConfig } from './utils/circuit-relay.js'
// @ts-expect-error
import log from 'why-is-node-running'

interface Before {
  env: {
    W3_TOKEN: string | null
  },
  libp2p: Libp2p
}

/** @type {import('aegir').PartialOptions} */
export default {
  test: {
    before: async (): Promise<Before> => {
      // get web3.storage token from shell or .env file
      let token: null | string = null
      if (typeof process.env.W3_TOKEN === 'string' && process.env.W3_TOKEN.length > 0) {
        token = process.env.W3_TOKEN
      } else {
        try {
          token = readFileSync('.w3_token', { encoding: 'utf-8'}).split('\n')[0]
        } catch {}
      }

      const libp2p = await createLibp2p(await getConfig())

      return {
        env: {
          W3_TOKEN: null ?? token
        },
        libp2p
      }
    },
    after: async (_: any, before: Before): Promise<void> => {
      await before.libp2p.stop()
      // was unable to get process to close on its own; fine for now
      process.exit(0)
    }
  }
}