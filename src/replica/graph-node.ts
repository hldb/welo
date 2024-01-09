import type { BlockView } from 'multiformats/interface'
import { encodeCbor, decodeCbor } from '@/utils/block.js'

export type Edge = 'out' | 'in'

export interface NodeValue {
  in: string[]
  out: string[]
  missing: boolean
  denied: boolean
}

export interface NodeObj {
  in: Set<string>
  out: Set<string>
  missing: boolean
  denied: boolean
}

// a non-missing or non-denied node can have empty sets for out and in
// a missing or denied node will always have out equal to an empty set
// a missing or denied node will always have in equal to a non empty set
export const initialNode: NodeObj = {
  in: new Set(),
  out: new Set(),
  missing: false,
  denied: false
}

export class Node implements NodeObj {
  in: Set<string>
  out: Set<string>
  missing: boolean
  denied: boolean

  // 'ni' because 'in' is a token
  constructor ({
    in: ni,
    out,
    missing,
    denied
  }: NodeValue | NodeObj = initialNode) {
    this.in = new Set(ni)
    this.out = new Set(out)
    this.missing = Boolean(missing)
    this.denied = Boolean(denied)
  }

  static async decode (bytes: Uint8Array): Promise<Node> {
    const { value: nodeValue } = await decodeCbor<NodeValue>(bytes)
    return new Node(nodeValue)
  }

  static init (): Node {
    return new Node()
  }

  static exists (node: Node | undefined): boolean {
    return node?.missing === false && !(node?.denied)
  }

  async encode (): Promise<BlockView<NodeValue>> {
    const simple: NodeValue = {
      in: Array.from(this.in),
      out: Array.from(this.out),
      missing: this.missing,
      denied: this.denied
    }
    return encodeCbor<NodeValue>(simple)
  }
}
