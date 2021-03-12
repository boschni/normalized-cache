import { isArrayType, resolveWrappedType, ValueType } from "../schema/types";
import type { Cache } from "../Cache";
import type {
  FieldNode,
  SelectionSetNode,
  DocumentNode,
} from "../language/ast";
import type { EntitiesRecord, Entity, PlainObject } from "../types";
import { isReference } from "../utils/cache";
import { clone, createRecord, hasOwn, isObject } from "../utils/data";
import { getSelectionSet, getSelectionFields, updateEntities } from "./shared";
import { maybeGetObjectField } from "../schema/utils";

interface ModifyOptions {
  entityID: string;
  selector: DocumentNode | undefined;
  onEntity: ModifyContext["onEntity"];
  onField: ModifyContext["onField"];
}

export interface ModifyResult {
  updatedEntityIDs?: string[];
}

interface ModifyContext {
  cache: Cache;
  entities: EntitiesRecord;
  optimistic?: boolean;
  selector: DocumentNode | undefined;
  path: (string | number)[];
  onEntity: (
    ctx: ModifyContext,
    entity: Entity,
    selectionSet: SelectionSetNode | undefined
  ) => boolean | void;
  onField: (
    ctx: ModifyContext,
    parent: PlainObject,
    field: FieldNode
  ) => boolean | void;
}

export function executeModify(
  cache: Cache,
  type: ValueType,
  optimistic: boolean,
  options: ModifyOptions
): ModifyResult {
  const ctx: ModifyContext = {
    cache,
    entities: createRecord(),
    onEntity: options.onEntity,
    onField: options.onField,
    selector: options.selector,
    path: [],
    optimistic,
  };

  const selectionSet = getSelectionSet(options.selector, type);

  traverseEntity(ctx, options.entityID, type, selectionSet);

  const updatedEntityIDs = updateEntities(cache, ctx.entities, optimistic);

  const result: ModifyResult = {};

  if (updatedEntityIDs.length) {
    result.updatedEntityIDs = updatedEntityIDs;
  }

  return result;
}

function traverseEntity(
  ctx: ModifyContext,
  entityID: string,
  type: ValueType | undefined,
  selectionSet: SelectionSetNode | undefined
): void {
  const entity = ctx.cache.get(entityID, ctx.optimistic);

  if (!entity) {
    return;
  }

  let copy = ctx.entities[entity.id];

  if (!copy) {
    copy = ctx.entities[entity.id] = clone(entity);
  }

  if (ctx.onEntity(ctx, copy, selectionSet) === false) {
    return;
  }

  traverseValue(ctx, selectionSet, type, copy.value);
}

function traverseValue(
  ctx: ModifyContext,
  selectionSet: SelectionSetNode | undefined,
  type: ValueType | undefined,
  data: unknown
): void {
  if (isReference(data)) {
    return traverseEntity(ctx, data.___ref, type, selectionSet);
  }

  type = type && resolveWrappedType(type, data);

  if (isObject(data)) {
    const selectionFields = getSelectionFields(
      ctx.selector,
      selectionSet,
      type,
      data
    );

    for (const fieldName of Object.keys(selectionFields)) {
      const selectionField = selectionFields[fieldName];

      if (!hasOwn(data, fieldName)) {
        continue;
      }

      ctx.path.push(fieldName);

      if (ctx.onField(ctx, data, selectionField) !== false) {
        if (selectionField.selectionSet) {
          const objectField = maybeGetObjectField(type, fieldName);

          traverseValue(
            ctx,
            selectionField.selectionSet,
            objectField && objectField.type,
            data[fieldName]
          );
        }
      }

      ctx.path.pop();
    }
  } else if (Array.isArray(data)) {
    const ofType = isArrayType(type) ? type.ofType : undefined;
    for (let i = 0; i < data.length; i++) {
      ctx.path.push(i);
      traverseValue(ctx, selectionSet, ofType, data[i]);
      ctx.path.pop();
    }
  }
}
