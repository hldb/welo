import { peerIdFromKeys } from '@libp2p/peer-id'
import { Multiaddr, multiaddr } from '@multiformats/multiaddr'
import type { Ed25519PeerId } from '@libp2p/interface/peer-id'

const publicKey = new Uint8Array([8, 1, 18, 32, 59, 59, 118, 163, 48, 43, 45, 125, 112, 49, 65, 51, 243, 119, 220, 67, 206, 11, 217, 202, 42, 208, 11, 106, 113, 216, 41, 159, 52, 165, 253, 42])
const privateKey = new Uint8Array([8, 1, 18, 64, 152, 214, 2, 64, 230, 152, 99, 24, 150, 9, 120, 211, 76, 198, 191, 44, 244, 127, 147, 226, 128, 168, 249, 241, 233, 73, 186, 105, 94, 207, 186, 144, 59, 59, 118, 163, 48, 43, 45, 125, 112, 49, 65, 51, 243, 119, 220, 67, 206, 11, 217, 202, 42, 208, 11, 106, 113, 216, 41, 159, 52, 165, 253, 42])

export const getId = async (): Promise<Ed25519PeerId> => await peerIdFromKeys(publicKey, privateKey) as Ed25519PeerId
export const getAddrs = async (): Promise<Multiaddr[]> => [
  multiaddr('/ip4/127.0.0.1/tcp/8760/p2p/' + (await getId()).toString()),
  multiaddr('/ip4/127.0.0.1/tcp/8761/ws/p2p/' + (await getId()).toString())
]
