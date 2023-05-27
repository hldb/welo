[![npm](https://img.shields.io/npm/v/welo?style=flat-square)](https://www.npmjs.com/package/welo)
[![Codecov](https://img.shields.io/codecov/c/github/hldb/welo?style=flat-square)](https://app.codecov.io/gh/hldb/welo)
![node-current](https://img.shields.io/node/v/welo?style=flat-square)
[![NPM](https://img.shields.io/npm/l/welo?color=green&style=flat-square)](./LICENSE)
[![Matrix](https://img.shields.io/badge/chat-%23hldb%3Amatrix.org-blue?style=flat-square)](https://matrix.to/#/#hldb:matrix.org)

<img src="https://user-images.githubusercontent.com/36933094/215352217-b9c5aca3-bfdc-46e4-9b42-504e7992fef8.png" alt="welo opal painting" width="400"/>

# welo

peer-to-peer, collaborative states using Merkle-CRDTs

[HLDB](https://github.com/hldb) implementation in Typescript

## Install

```bash
npm install welo
```

## Usage

```typescript
import { createHelia } from 'helia'
import { MemoryDatastore } from 'datastore-core'
import {
  createWelo,
  staticAccess,
  basalEntry,
  basalIdentity,
  keyvalueStore,
  liveReplicator
} from 'welo'

/** look at Helia for configurations */
const ipfs = await createHelia()

/** see more config options in the API docs */
await createWelo({
  ipfs,
  datastore: new MemoryDatastore(),
  replicators: [liveReplicator()],

  handlers: {
    identity: [basalIdentity()],
    access: [staticAccess()],
    store: [keyvalueStore()],
    entry: [basalEntry()]
  }
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

This project is [dual licensed](./LICENSE) under [APACHE-2.0](./LICENSE-APACHE) and [MIT](./LICENSE-MIT).

## Funding

Thanks to [Protocol Labs](https://protocol.io) for funding this project through this [grant](https://github.com/tabcat/rough-opal).
