[![npm](https://img.shields.io/npm/v/welo?style=flat-square)](https://www.npmjs.com/package/welo)
[![Codecov](https://img.shields.io/codecov/c/github/hldb/welo?style=flat-square)](https://app.codecov.io/gh/hldb/welo)
![node-current](https://img.shields.io/node/v/welo?style=flat-square)
[![NPM](https://img.shields.io/npm/l/welo?color=green&style=flat-square)](./LICENSE)
[![Matrix](https://img.shields.io/badge/chat-%23hldb%3Amatrix.org-blue?style=flat-square)](https://matrix.to/#/#hldb:matrix.org)

<img src="https://user-images.githubusercontent.com/36933094/215352217-b9c5aca3-bfdc-46e4-9b42-504e7992fef8.png" alt="welo opal painting" width="400"/>

# welo

peer-to-peer, collaborative states using Merkle-CRDTs

[HLDB](https://github.com/hldb) implementation in Typescript

## Project Status

```
I am currently working on https://github.com/tabcat/dd-tree which will be the core structure for the database.
It has not been simple but I am making small progress daily.
It is the hardest part of the project from a technical standpoint and I want to have a solid solution that will last.
To track this project's progress see this issue: https://github.com/hldb/welo/issues/102
```
-[tabcat](https://github.com/tabcat)

## Install

```bash
npm install welo
```

## Usage

```typescript
import { createHelia } from 'helia'
import { createWelo } from 'welo'

/** look at Helia for more configuration */
const ipfs = await createHelia()

/** see more config options in the API docs */
const welo = await createWelo({ ipfs })

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

Check out the [API Docs](https://hldb.github.io/welo)

## Examples

[TodoMVC](https://github.com/hldb/todomvc)

## License

This project is [dual licensed](./LICENSE) under [APACHE-2.0](./LICENSE-APACHE) and [MIT](./LICENSE-MIT).

## Funding

Thanks to [Protocol Labs](https://protocol.io) for funding this project through this [grant](https://github.com/tabcat/rough-opal).
