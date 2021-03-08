import { resolveNamedType, unwrapType, ValueType } from "../schema/types";
import type { PlainObjectWithMeta, Ref } from "../types";
import { isObject, stableValueHash } from "./data";

export function createReference(entityID: string): Ref {
  return { ___ref: entityID };
}

export function isReference(value: unknown): value is Ref {
  return Boolean(isObject(value) && value.___ref);
}

export function isObjectWithMeta(value: unknown): value is PlainObjectWithMeta {
  return Boolean(isObject(value) && value.___invalidated);
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
