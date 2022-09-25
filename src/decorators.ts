/* class decorators */

export type Implements<Instance> = new(props: any) => Instance

export function Extends<T> () {
  return <U extends T>(constructor: U) => {}
}
