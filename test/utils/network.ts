import type { Libp2p } from '@libp2p/interface-libp2p'

export const hasMultiaddrs = (libp2p: Libp2p): boolean => libp2p.getMultiaddrs().length > 0

export const waitForMultiaddrs = async (libp2p: Libp2p): Promise<void> => {
  await new Promise<void>(resolve => {
    (function checkForAddrs (): void {
      if (hasMultiaddrs(libp2p)) {
        resolve()
      } else {
        libp2p.addEventListener('self:peer:update', checkForAddrs, { once: true })
      }
    })()
  })
}
