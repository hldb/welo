export type Role = 'reader' | 'writer' | 'mod' | 'admin'

export interface AccountAccess {
  role: Role
  version: number
  hash: Uint8Array
  keys?: {
    [signer: string]: Uint8Array
  }
}

export interface WriteProtectedAccountAccess extends Omit<AccountAccess, 'keys'> {}
export interface ReadProtectedAccountAccess extends Required<AccountAccess> {}

export interface Access {
  author?: Uint8Array
  accounts: {
    [account: string]: AccountAccess
  }
}

export interface WriteProtectedAccess extends Omit<Access, 'author'> {
  accounts: {
    [account: string]: WriteProtectedAccountAccess
  }
}

export interface ReadProtectedAccess extends Required<Access> {
  accounts: {
    [account: string]: ReadProtectedAccountAccess
  }
}
