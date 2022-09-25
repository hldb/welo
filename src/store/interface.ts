import { Registrant } from '../registry/registrant'

interface actions {
  [key: string]: 
}

export interface Instance {
  get actions(): Object<string, () => 
}

export interface Static extends Registrant<Instance> {

}
