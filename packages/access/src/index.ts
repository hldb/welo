import type { ByteView } from 'multiformats'
import type { Account } from '@welo/account'

export type Role = 'reader' | 'writer' | 'mod' | 'admin'

export interface AccountAccess {
  data: ByteView<Omit<Account, 'root'>>
  role: Role
  keys?: {
    [signer: string]: Uint8Array
  }
}

export interface WriteProtectedAccountAccess extends Omit<AccountAccess, 'keys'> {}
export interface ReadProtectedAccountAccess extends Required<AccountAccess> {}

export interface EpochAccess {
  author?: Uint8Array
  accounts: {
    [account: string]: AccountAccess
  }
}

export interface WriteProtectedEpochAccess extends Omit<EpochAccess, 'author'> {
  accounts: {
    [account: string]: WriteProtectedAccountAccess
  }
}

export interface ReadProtectedEpochAccess extends Required<EpochAccess> {
  accounts: {
    [account: string]: ReadProtectedAccountAccess
  }
}

export interface Access {
  [epoch: string]: EpochAccess
}

export interface WriteProtectedAccess extends Access {
  [epoch: string]: WriteProtectedEpochAccess
}

export interface ReadProtectedAccess extends Access {
  [epoch: string]: ReadProtectedEpochAccess
}
