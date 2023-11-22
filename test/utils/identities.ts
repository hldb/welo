import { base32 } from 'multiformats/bases/base32'
import type { LevelDatastore } from 'datastore-level'
import type { KeyChain } from '@libp2p/interface/keychain'

import { Identity, basalIdentity } from '@/identity/basal/index.js'

import getDatastore from './level-datastore.js'
import type { TestPaths } from './constants.js'

export const getTestIdentities = async (
  testPaths: TestPaths
): Promise<LevelDatastore> =>
  await getDatastore(testPaths.identities)

export const getTestIdentity = async (
  testIdentities: LevelDatastore,
  testKeychain: KeyChain,
  name: string
): Promise<Identity> => {
  await testIdentities.open()

  const identity = await basalIdentity().get({
    name,
    identities: testIdentities,
    keychain: testKeychain
  })

  return identity
}

export const kpi = base32.decode(
  'bujrxazlnpbwg2tklmzzgentqjj2vk3zziuyhqz3sgvde6zblpjtxezzsjfzha5rqpfrxq2tzlfqs63btjrxuiwdcjjlve6ktnf3veqzujeztknbtpjcxo5rynnuviulsjvwfcmlqnizgg3cyhbbdc4rxhblfsudnjvshel2wpjdwqtdxizufkqknnbuwizlooruxi6kyukrwe2lelasqqaqseebd2dcxup53qcflrr74f6ov4sulbeqtr7gebgvly7yjp4cpqcb62o3dob2wewbfbabbeiichugfpi73xaekxdd7yl45lzfiwcjbhd6micnkxr7qs7ye7aed5u5wg43jm5memmceaiqbxmbfxub7wpfe7o4kedmlpyvgxacrbk4sizxhqa57g6r6r4xk4kicebxx2krffxna23pegemozn6abevp4yezrcejs7a6ag4nw6auub3m6'
)
