export const tempPath = './test/temp'
export const fixtPath = './test/fixtures'
export const identitiesPath = '/identities'
export const keychainPath = '/keychain'
export const ipfsPath = '/ipfs'
export const databasePath = '/database'
export const replicaPath = databasePath + '/replica'
export const storePath = databasePath + '/store'

export type TestRoot = typeof tempPath | typeof fixtPath

export interface TestPaths {
  test: string
  identities: string
  keychain: string
  ipfs: string
  database: string
  replica: string
  store: string
}

export const getTestPaths = (
  testRoot: TestRoot,
  testName: string
): TestPaths => ({
  test: testRoot + '/' + testName,
  identities: testRoot + '/' + testName + identitiesPath,
  keychain: testRoot + '/' + testName + keychainPath,
  ipfs: testRoot + '/' + testName + ipfsPath,
  database: testRoot + '/' + testName + databasePath,
  replica: testRoot + '/' + testName + replicaPath,
  store: testRoot + '/' + testName + storePath
})

export const names = {
  name0: 'name0',
  name1: 'name1',
  name2: 'name2'
}
