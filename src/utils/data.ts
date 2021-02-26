import { PlainObject } from "../types";

export function stableValueHash(value: unknown): string {
  switch (typeof value) {
    case "string":
      return value;
    case "number":
      return value.toString();
    default:
      return JSON.stringify(value, (_, val) =>
        isObject(val)
          ? Object.keys(val)
              .sort()
              .reduce((result, key) => {
                result[key] = val[key];
                return result;
              }, {} as any)
          : val
      );
  }
}

/**
 * This function returns `a` if `b` is deeply equal.
 * If not, it will replace any deeply equal children of `b` with those of `a`.
 * This can be used for structural sharing between JSON values for example.
 */
export function replaceEqualDeep<T>(a: unknown, b: T): T;
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function replaceEqualDeep(a: any, b: any): any {
  if (a === b) {
    return a;
  }

  const array = Array.isArray(a) && Array.isArray(b);

  if (array || (isObject(a) && isObject(b))) {
    const aSize = array ? a.length : Object.keys(a).length;
    const bItems = array ? b : Object.keys(b);
    const bSize = bItems.length;
    const copy: any = array ? [] : {};

    let equalItems = 0;

    for (let i = 0; i < bSize; i++) {
      const key = array ? i : bItems[i];
      copy[key] = replaceEqualDeep(a[key], b[key]);
      if (copy[key] === a[key]) {
        equalItems++;
      }
    }

    return aSize === bSize && equalItems === aSize ? a : copy;
  }

  return b;
}

export function isObject(value: unknown): value is PlainObject {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function hasOwn(obj: unknown, prop: string | number): boolean {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

export function createRecord<K extends string | number, T>(): Record<K, T> {
  return Object.create(null);
}

export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}
