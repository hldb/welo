# Changelog

## [4.2.0](https://github.com/hldb/welo/compare/v4.1.1...v4.2.0) (2024-04-03)


### Features

* add abort options to requests. ([ebc7d58](https://github.com/hldb/welo/commit/ebc7d5804cbf8f32ab570c23b6b049a94f61cd5b))


### Bug Fixes

* add missing dependency ([d8f489d](https://github.com/hldb/welo/commit/d8f489dd310df3e375769de444a11088779b2b71))

## [4.1.1](https://github.com/hldb/welo/compare/v4.1.0...v4.1.1) (2024-02-13)


### Bug Fixes

* prevent the heads promise from throwing ([59b592c](https://github.com/hldb/welo/commit/59b592c8252cfab380d4cd9b50988601cc1d3c38))
* replace broken bloom filter ([05edd0d](https://github.com/hldb/welo/commit/05edd0d52feadd14099c2e20aeb1043b403308aa))

## [4.1.0](https://github.com/hldb/welo/compare/v4.0.0...v4.1.0) (2024-02-04)


### Features

* allow any file to be imported ([70c11f8](https://github.com/hldb/welo/commit/70c11f8a336f3d1da4c17cecc4bedcf3045d8f50))

## [4.0.0](https://github.com/hldb/welo/compare/v3.0.1...v4.0.0) (2024-01-09)


### ⚠ BREAKING CHANGES

* update all packages
* update libp2p, modules and aegir.
* Update libp2p packages.

### deps

* update all packages ([f79af02](https://github.com/hldb/welo/commit/f79af024e5cbbfb3de3f267d265b9328f9afd078))
* update libp2p, modules and aegir. ([745e949](https://github.com/hldb/welo/commit/745e9490090c9bf778e928f9fd80bf9e620f9b8f))


### Bug Fixes

* await stream close promises. ([9166c8f](https://github.com/hldb/welo/commit/9166c8f1d1c8c1be54cb46039ad6890dd3ef7b30))
* bootstrap stream types ([6509cfb](https://github.com/hldb/welo/commit/6509cfbd82f2f31e5b117c711030a7a777d13429))
* resolve the validation promise if the remote validates first. ([61f253a](https://github.com/hldb/welo/commit/61f253a8a96aaf3aa38904aa5f78f1600650639c))
* update zzzync replicator. ([e50d367](https://github.com/hldb/welo/commit/e50d3671b47aaeef74e9b9227708eecff24679f3))


### Miscellaneous Chores

* Update libp2p packages. ([a15c7a7](https://github.com/hldb/welo/commit/a15c7a75fa60f07cc31c8c256b81479cc3daecad))

## [3.0.1](https://github.com/hldb/welo/compare/v3.0.0...v3.0.1) (2023-10-16)


### Bug Fixes

* ignore errors on heads exchange failures ([f532862](https://github.com/hldb/welo/commit/f53286287d4725b06250028088ea7fa216e5e78b))
* unhandled error in heads exchange ([91536e8](https://github.com/hldb/welo/commit/91536e821a4e8162ab8a28a887f637f1bfa1c34a))

## [3.0.0](https://github.com/hldb/welo/compare/v2.3.0...v3.0.0) (2023-09-18)


### ⚠ BREAKING CHANGES

* remove Blocks api

### Code Refactoring

* remove Blocks api ([ec67ea4](https://github.com/hldb/welo/commit/ec67ea4a1be8fb5cf937d2a718717131ecf257f8)), closes [#79](https://github.com/hldb/welo/issues/79)

## [2.3.0](https://github.com/hldb/welo/compare/v2.2.3...v2.3.0) (2023-07-18)


### Features

* add writes method to replica ([c2a474f](https://github.com/hldb/welo/commit/c2a474f6617da42d9b6dac43f7b45c28a6eff2b6))
* newEntry method added to replica ([4e5f918](https://github.com/hldb/welo/commit/4e5f918f274980435120ce5a384d465d56dcef38))


### Bug Fixes

* type error in replica.writes ([1ddd31c](https://github.com/hldb/welo/commit/1ddd31cdb9ddfed9712f7e8240defd75f982d756))
* zzzync replicator improvements ([a20c2ed](https://github.com/hldb/welo/commit/a20c2edf2d5cf804a3d9e350d36445267ffc7148))

## [2.2.3](https://github.com/hldb/welo/compare/v2.2.2...v2.2.3) (2023-07-15)


### Bug Fixes

* zzzync replicator uploads everything ([2a961df](https://github.com/hldb/welo/commit/2a961df0cae9f6c84c6e2c0ba4ebefd9896ed09d))

## [2.2.2](https://github.com/hldb/welo/compare/v2.2.1...v2.2.2) (2023-07-14)


### Bug Fixes

* zzzync also uses GET_PROVIDERS queries ([91b1b73](https://github.com/hldb/welo/commit/91b1b733e8c378ecb178527be339b20cbfe6d8f2))
* zzzync upload checks if cid ([85b981b](https://github.com/hldb/welo/commit/85b981bf135460b540725986dc70c9da41398457))

## [2.2.1](https://github.com/hldb/welo/compare/v2.2.0...v2.2.1) (2023-07-11)


### Bug Fixes

* remove console.log(providers) artifact ([ce4b946](https://github.com/hldb/welo/commit/ce4b946474fb2e9c22f16a1fee3f7b42ae5d8ee8))
* zzzync replicator impl and test success ([da6e9d3](https://github.com/hldb/welo/commit/da6e9d317cb024c5e21a3b62c97b0647b86e4380))

## [2.2.0](https://github.com/hldb/welo/compare/v2.1.1...v2.2.0) (2023-07-10)


### Features

* welo.open provider option for zzzync ([14289f8](https://github.com/hldb/welo/commit/14289f8aa46a998a3960e158ae0e0409695bbc23))

## [2.1.1](https://github.com/hldb/welo/compare/v2.1.0...v2.1.1) (2023-07-10)


### Bug Fixes

* specify outDir when baseUrl is present ([c41e0af](https://github.com/hldb/welo/commit/c41e0af94336f67e1813ac26de8920c983081ce4))
* ts target ES2020 ([f517e8d](https://github.com/hldb/welo/commit/f517e8d6f31df493fa75eee9d42aea639bcbe830))

## [2.1.0](https://github.com/hldb/welo/compare/v2.0.0...v2.1.0) (2023-07-07)


### Features

* iterators for keyvalue store ([e71d814](https://github.com/hldb/welo/commit/e71d8146a23258e562dd5f44897878fbb4e99264))
* zzzync replicator can be scoped to lan|wan ([0a6a1ea](https://github.com/hldb/welo/commit/0a6a1ea216bb2807f8f0a889a9e38431d2cefa89))

## [2.0.0](https://github.com/hldb/welo/compare/v1.1.0...v2.0.0) (2023-06-13)


### ⚠ BREAKING CHANGES

* Merge pull request #71 from saul-jb/refactor/modularization

### Features

* default welo bundle ([d94dafb](https://github.com/hldb/welo/commit/d94dafb8ff880bdb5c42400fa1a309c43900b5d1)), closes [#76](https://github.com/hldb/welo/issues/76)


### Code Refactoring

* Merge pull request [#71](https://github.com/hldb/welo/issues/71) from saul-jb/refactor/modularization ([2818587](https://github.com/hldb/welo/commit/2818587ef756d767963ba7e46233f2c99ee1234f))

## [1.1.0](https://github.com/hldb/welo/compare/v1.0.2...v1.1.0) (2023-03-01)


### Features

* bundle LiveReplicator ([51a38b6](https://github.com/hldb/welo/commit/51a38b67dc6288cafaf58835388116b121a1f14d))


### Bug Fixes

* ipfs/libp2p required DbOpen type ([eb6e610](https://github.com/hldb/welo/commit/eb6e610bb1c080f051a86218db7c582fdcbe11f5))
* LiveReplicator fits ReplicatorClass ([e9e2829](https://github.com/hldb/welo/commit/e9e282971d389cb76dd8ada766ec6020ecf81f2e))
* LiveReplicator fits ReplicatorClass ([ebcefbc](https://github.com/hldb/welo/commit/ebcefbcca6ad08ef437f4a19014e447d1dcb308e))
* LiveReplicator is Registrant ([134b5fa](https://github.com/hldb/welo/commit/134b5fa4bb0a9d83b7d9b2f4bd5e399f24414b84))
* loosen dagLinks graph/access types ([66ae8dc](https://github.com/hldb/welo/commit/66ae8dcd56946ac79b1afe0f8f05132f4ef50262))
* replicator class prop type ([64d0ca5](https://github.com/hldb/welo/commit/64d0ca519ae40e3f9f0db57dd316cbc242a5e6ef))
* specify valid direction types ([2c4ff89](https://github.com/hldb/welo/commit/2c4ff89dc865ff0ccfc98a40ff16cce240300026))


### Performance Improvements

* add benchmark ([1dcf196](https://github.com/hldb/welo/commit/1dcf196ab28a3469fb0e6ad487067d6b55257fc2))

## [1.0.2](https://github.com/hldb/welo/compare/v1.0.1...v1.0.2) (2022-12-28)


### Bug Fixes

* add deps [#35](https://github.com/hldb/welo/issues/35) ([98a03f8](https://github.com/hldb/welo/commit/98a03f8d8ecf1802ee3b2ce2833e428c817e92fc)), closes [#30](https://github.com/hldb/welo/issues/30)
