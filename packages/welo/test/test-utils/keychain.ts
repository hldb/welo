import { DefaultKeyChain, type KeyChainComponents } from '@libp2p/keychain'
import type { KeyChain } from '@libp2p/interface/keychain'
import { MemoryDatastore } from 'datastore-core'

const components: KeyChainComponents = {
  datastore: new MemoryDatastore()
}

export function getTestKeyChain (): KeyChain {
  return new DefaultKeyChain(components, {})
}
