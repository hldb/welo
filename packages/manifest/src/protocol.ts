import version from './version.js'

export const protocol = `/hldb/oplog/${version}` as const 
export type Protocol = typeof protocol
