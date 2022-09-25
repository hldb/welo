import { Instance as EntryInstance } from '../entry/interface'
import { Registrant } from '../registry/registrant'
import { ManifestInterface } from '../manifest/interface'

export interface Instance {
  canAppend: (entry: EntryInstance<any>) => Promise<boolean>

  close: () => Promise<void>
}

export interface Open {
  manifest: ManifestInterface<any>
}

export interface Static extends Registrant<Instance> {
  open: (open: Open) => Promise<Instance>
}
