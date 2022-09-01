
import { Storage } from '../../src/util.js'

const pub = new Uint8Array([
    8,   2,  18,  33,   2, 187, 186, 248,  92,
   29, 208, 141, 101,   2, 203,  79,  47,  43,
   79, 212,  95, 122, 235, 220, 254,  59,  63,
  139, 220,  61, 159,   0, 186,  49,  29, 153,
  236
])

const identityData = {
  id: pub,
  pub,
  sig: new Uint8Array([
     48,  68,   2,  32,  20,  98, 204,  51, 117, 207, 198, 153,
     68, 103,  62, 201, 170, 175, 220,  34, 181, 120, 105,  13,
    111,  35,  72,  24, 118,  93,  62, 168, 252,   3, 148,  65,
      2,  32,  53,  19,   2, 234,   2,  93, 157, 163, 229, 236,
     45, 116,  81, 238, 188,  93, 206, 156, 181, 104, 235, 168,
    237,  89, 143, 180,  38,  43, 217, 120, 253, 230
  ])
}

const pem = 'm82uWH/F1W2r6YM2uMRBFb2gWl9NhV+7HMMgfAJnloUaw8CPRExbPIRl2Me7S/uX8lqKOanZgrfxsqvSrMhzTregkcsr4NRoGwVUwUEW30HM'

const storage = () => ({
  identities: new Storage('./test/fixtures/identities'),
  keychain: new Storage('./test/fixtures/keychain'),
  temp: {
    identities: new Storage('./test/temp/identities'),
    keychain: new Storage('./test/temp/keychain')
  }
})

export const identity = {
  pub,
  identityData,
  pem,
  storage
}


