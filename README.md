
# welo

peer-to-peer, collaborative states using [merkle-crdts](https://research.protocol.ai/publications/merkle-crdts-merkle-dags-meet-crdts/).

Beta Release Tacker: https://github.com/opalsnt/welo/issues/8

![DALL·E 2022-09-27 21 45 51 - cabochon gemstone opal  translucent vibrant multi-color  AAA+ grade  100 carats  macro photography  kaleidoscope inside the opal  ](https://user-images.githubusercontent.com/36933094/203710996-860c60cf-bddf-4c5b-b5c9-5b46d32f076f.png)

## Install

```bash
npm install welo
```

## Usage

```typescript
import IPFS from 'ipfs'
import { Welo } from 'welo'

/** look at js-ipfs for configurations */
const ipfs = await IPFS.create() // 

/** see more config options in the API docs */
const welo = await Welo.create({
  ipfs,
  libp2p: ipfs.libp2p // ipfs.libp2p will throw a typescript error; it's a hack for now
})

/** create a manifest for a keyvalue database */
const manifest = await welo.determine({
  name: 'this is the databases name',
  type: 'keyvalue'
})

/** open the keyvalue database */
const keyvalue = await welo.open(manifest)

/** The keyvalue API docs are not uploaded yet */

const entryCID = await keyvalue.put('key', 'value')
const value = await keyvalue.get('key')
const entryCID = await keyvalue.del('key')
```

Check out the [tests](./test) for more usage examples for now.

## API

Check out the [API Docs](./API/index.md)

## License

This project is [dual licensed](./LICENSE) under [MIT](./LICENSE-MIT) and [APACHE](./LICENSE-APACHE).

## Funding

Thanks to [Protocol Labs](https://protocol.io) for Funding this project through a [grant](https://github.com/tabcat/rough-opal).
