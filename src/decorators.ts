/* class decorators */

export function Extends<T> () {
  return <U extends T>(constructor: U) => {}
}
