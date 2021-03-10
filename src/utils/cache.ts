import type { Cache } from "../Cache";
import { resolveNamedType, unwrapType, ValueType } from "../schema/types";
import type { Entity, PlainObjectWithMeta, Reference } from "../types";
import { isObject, stableValueHash } from "./data";

export function createReference(entityID: string): Reference {
  return { ___ref: entityID };
}

export function isReference(value: unknown): value is Reference {
  return Boolean(isObject(value) && value.___ref);
}

export function isObjectWithMeta(value: unknown): value is PlainObjectWithMeta {
  return Boolean(isObject(value) && value.___invalidated);
}

export function isMetaKey(key: string): boolean {
  return key === "___expiresAt" || key === "___invalidated";
}

function createEntityID(typeName: string, id: unknown): string {
  return `${typeName}:${stableValueHash(id)}`;
}

export function identifyByData(
  type: ValueType,
  data: unknown
): string | undefined {
  const id =
    type.name && typeof type.id === "function" ? type.id(data) : undefined;

  if (id !== undefined) {
    return createEntityID(type.name!, id);
  }

  const unwrappedType = unwrapType(type, data);

  if (unwrappedType) {
    return identifyByData(unwrappedType, data);
  }
}

export function identifyById(type: ValueType, id: unknown): string | undefined {
  const namedType = resolveNamedType(type);
  return namedType ? createEntityID(namedType.name!, id) : undefined;
}

export function identifyByType(type: ValueType): string | undefined {
  const namedType = resolveNamedType(type);
  return namedType ? namedType.name : undefined;
}

export function identify(type: ValueType, id?: unknown): string | undefined {
  return id === undefined ? identifyByType(type) : identifyById(type, id);
}

export function resolveEntity(
  cache: Cache,
  type: ValueType,
  id: unknown,
  optimistic: boolean | undefined
): Entity | undefined {
  const entityID = identify(type, id);

  if (entityID) {
    return cache.get(entityID, optimistic);
  }
}
