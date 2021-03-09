import type { Cache } from "../Cache";
import type { Entity, InvalidField, MissingField, PlainObject } from "../types";
import {
  isArrayType,
  isObjectType,
  ObjectFieldReadContext,
  resolveWrappedType,
  ValueType,
} from "../schema/types";
import { SelectionSetNode, SelectorNode } from "../language/ast";
import {
  createReference,
  identify,
  isObjectWithMeta,
  isReference,
} from "../utils/cache";
import { hasOwn } from "../utils/data";
import { resolveSelectionSet, getSelectionFields } from "./shared";
import { isValid } from "../schema/utils";

interface ReadOptions {
  id?: unknown;
  optimistic?: boolean;
  select?: SelectorNode;
  type: ValueType;
}

export interface ReadResult<T = any> {
  data?: T;
  expiresAt: number;
  invalidFields?: InvalidField[];
  invalidated: boolean;
  missingFields?: MissingField[];
  selector?: SelectorNode;
  stale: boolean;
}

interface ReadContext {
  cache: Cache;
  expiresAt: number;
  invalidFields: InvalidField[];
  invalidated: boolean;
  missingFields: MissingField[];
  /**
   * Keeps track of the results of entities which were selected without selection set.
   * This is used to build results with circular references.
   */
  fullEntityResults: Record<string, PlainObject>;
  optimistic?: boolean;
  path: (string | number)[];
}

export function executeRead<T>(
  cache: Cache,
  options: ReadOptions
): ReadResult<T> {
  const result: ReadResult = {
    expiresAt: -1,
    invalidated: false,
    selector: options.select,
    stale: true,
  };

  const entityID = identify(options.type, options.id);

  if (!entityID) {
    return result;
  }

  const entity = cache.get(entityID, options.optimistic);

  if (!entity) {
    return result;
  }

  const ctx: ReadContext = {
    cache,
    expiresAt: -1,
    invalidFields: [],
    invalidated: false,
    missingFields: [],
    fullEntityResults: {},
    optimistic: options.optimistic,
    path: [],
  };

  result.data = traverseEntity(ctx, entity, options.type, options.select);
  result.invalidated = ctx.invalidated;
  result.expiresAt = ctx.expiresAt;

  if (ctx.missingFields.length) {
    result.missingFields = ctx.missingFields;
  }

  if (ctx.invalidFields.length) {
    result.invalidFields = ctx.invalidFields;
  }

  result.stale =
    result.invalidated ||
    (result.expiresAt !== -1 && result.expiresAt <= Date.now());

  return result;
}

function traverseEntity(
  ctx: ReadContext,
  entity: Entity,
  type: ValueType | undefined,
  selector: SelectorNode | undefined
): any {
  const selectionSet = resolveSelectionSet(selector, type);

  if (!selectionSet && ctx.fullEntityResults[entity.id]) {
    return ctx.fullEntityResults[entity.id];
  }

  checkExpiresAt(ctx, entity.expiresAt);
  checkInvalidated(ctx, entity.invalidated);

  return traverseValue(ctx, selectionSet, type, entity, entity.value);
}

function traverseValue(
  ctx: ReadContext,
  selectionSet: SelectionSetNode | undefined,
  type: ValueType | undefined,
  entity: Entity | undefined,
  data: unknown
): any {
  if (isReference(data)) {
    const refEntity = ctx.cache.get(data.___ref, ctx.optimistic);

    if (!refEntity) {
      addMissingField(ctx);
      return;
    }

    return traverseEntity(ctx, refEntity, type, selectionSet);
  }

  if (type) {
    if (isValid(type, data)) {
      type = resolveWrappedType(type, data);
    } else {
      addInvalidField(ctx, data);
    }
  }

  if (isObjectWithMeta(data)) {
    const result: PlainObject = {};

    if (entity && !selectionSet) {
      ctx.fullEntityResults[entity.id] = result;
    }

    const selectionFields = getSelectionFields(selectionSet, type, data);

    for (const name of Object.keys(selectionFields)) {
      ctx.path.push(name);

      let fieldValue: unknown;
      let fieldValueFound = false;

      const typeField = isObjectType(type) ? type.getfield(name) : undefined;

      if (typeField && typeField.read) {
        const fieldReadCtx: ObjectFieldReadContext = {
          toReference: (options) => {
            const entityID = ctx.cache.identify(options);
            return entityID ? createReference(entityID) : undefined;
          },
        };
        fieldValue = typeField.read(data, fieldReadCtx);
        fieldValueFound = true;
      } else if (hasOwn(data, name)) {
        fieldValue = data[name];
        fieldValueFound = true;
      }

      if (fieldValueFound) {
        checkExpiresAt(ctx, data.___expiresAt[name]);
        checkInvalidated(ctx, data.___invalidated[name]);

        const selectionField = selectionFields[name];
        const alias = selectionField.alias ? selectionField.alias.value : name;

        result[alias] = traverseValue(
          ctx,
          selectionField.selectionSet,
          typeField && typeField.type,
          undefined,
          fieldValue
        );
      } else {
        addMissingField(ctx);
      }

      ctx.path.pop();
    }

    return result;
  }

  if (Array.isArray(data)) {
    const ofType = isArrayType(type) ? type.ofType : undefined;
    const result: unknown[] = [];

    for (let i = 0; i < data.length; i++) {
      ctx.path.push(i);
      result.push(traverseValue(ctx, selectionSet, ofType, undefined, data[i]));
      ctx.path.pop();
    }

    return result;
  }

  return data;
}

function addMissingField(ctx: ReadContext) {
  ctx.missingFields.push({ path: [...ctx.path] });
}

function addInvalidField(ctx: ReadContext, value: unknown) {
  ctx.invalidFields.push({ path: [...ctx.path], value });
}

function checkInvalidated(ctx: ReadContext, invalidated: boolean) {
  if (invalidated) {
    ctx.invalidated = true;
  }
}

function checkExpiresAt(ctx: ReadContext, expiresAt: number) {
  if (expiresAt !== -1 && (ctx.expiresAt === -1 || expiresAt < ctx.expiresAt)) {
    ctx.expiresAt = expiresAt;
  }
}
