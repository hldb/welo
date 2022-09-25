/* class decorators */

export function staticImplements<T> () {
  return <U extends T>(constructor: U) => {}
}
