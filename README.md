
# opal
> name is temporary 🚧 maybe?

peer-to-peer, collaborative states using [merkle-crdts](https://research.protocol.ai/publications/merkle-crdts-merkle-dags-meet-crdts/).

Beta Release Tacker: https://github.com/cypsela/opal/issues/8

![DALL·E 2022-09-27 21 45 51 - cabochon gemstone opal  translucent vibrant multi-color  AAA+ grade  100 carats  macro photography  kaleidoscope inside the opal  ](https://user-images.githubusercontent.com/36933094/203710996-860c60cf-bddf-4c5b-b5c9-5b46d32f076f.png)

## Install

```bash
npm install @cypsela/opal
```

## Usage

```typescript
import IPFS from 'ipfs'
import { Opal } from '@cypsela/opal'

/** look at js-ipfs for configurations */
const ipfs = await IPFS.create() // 

/** see more config options in the API docs */
const opal = await Opal.create({ ipfs, libp2p: ipfs.libp2p }) // ipfs.libp2p will throw a typescript error; it's a hack for now

/** create a manifest for a keyvalue database */
const manifest = await opal.determine({ name: 'this is the databases name', type: 'keyvalue' })

/** open the keyvalue database */
const keyvalue = await opal.open(manifest)

/** The keyvalue API docs are not uploaded yet */
```

Check out the [tests](./test) for more usage examples for now.

## API

Check out the [API Docs](./API/index.md)

## License

This project is [dual licensed](./LICENSE) under [MIT](./LICENSE-MIT) and [APACHE](./LICENSE-APACHE).

## Funding

Thanks to [Protocol Labs](https://protocol.io) for Funding this project through a [grant](https://github.com/tabcat/rough-opal).
