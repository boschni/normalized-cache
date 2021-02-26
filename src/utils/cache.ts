import { ValueType, ObjectType } from "../schema/types";
import type { Entity, PlainObjectWithMeta, Ref } from "../types";
import { isObject, stableValueHash } from "./data";
import { invariant, ErrorCode } from "./invariant";

export function isEntity(value: unknown): value is Entity {
  return Boolean(isObjectWithMeta(value) && value.id !== undefined);
}

export function isReference(value: unknown): value is Ref {
  return Boolean(isObject(value) && value.___ref);
}

export function isObjectWithMeta(value: unknown): value is PlainObjectWithMeta {
  return Boolean(isObject(value) && value.___invalidated);
}

export function createReference(entityID: string): Ref {
  return { ___ref: entityID };
}

export function ensureEntityID(
  type: ValueType,
  id?: unknown,
  data?: unknown
): string {
  const entityID = identify({ type, id, data });

  invariant(
    entityID,
    process.env.NODE_ENV === "production"
      ? ErrorCode.UNABLE_TO_INFER_ENTITY_ID
      : `Could not infer entity ID`
  );

  return entityID;
}

function resolveID(type: ValueType, data: unknown): any | undefined {
  return type instanceof ObjectType && typeof type.id === "function"
    ? type.id(data)
    : isObject(data)
    ? data.id
    : undefined;
}

function createEntityID(typeName: string, id?: unknown): string {
  return typeof id === "undefined" || id === ""
    ? typeName
    : `${typeName}:${stableValueHash(id)}`;
}

interface IdentifyOptions {
  data?: unknown;
  id?: unknown;
  strict?: boolean;
  type: ValueType;
}

export function identify(options: IdentifyOptions): string | undefined {
  if (!options.type.name) {
    return;
  }

  let id = options.id;

  if (typeof id === "undefined") {
    id = resolveID(options.type, options.data);
  }

  if (options.strict && (typeof id === "undefined" || id === "")) {
    return;
  }

  return createEntityID(options.type.name, id);
}
