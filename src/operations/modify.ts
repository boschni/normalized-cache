import { ArrayType, ObjectType, UnionType, ValueType } from "../schema/types";
import type { Cache } from "../Cache";
import type {
  FieldNode,
  SelectionSetNode,
  SelectorNode,
} from "../language/ast";
import type { EntitiesRecord, Entity, PlainObject } from "../types";
import { isReference } from "../utils/cache";
import { clone, createRecord, hasOwn, isObject } from "../utils/data";
import {
  resolveSelectionSet,
  getSelectionFields,
  persistEntities,
} from "./shared";

interface ModifyConfig {
  cache: Cache;
  optimistic?: boolean;
  entityID: string;
  type: ValueType;
  selector: SelectorNode | undefined;
  onEntity: ModifyContext["onEntity"];
  onField: ModifyContext["onField"];
}

interface ModifyContext {
  cache: Cache;
  entities: EntitiesRecord;
  optimistic?: boolean;
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

export function modify(config: ModifyConfig): string[] {
  const ctx: ModifyContext = {
    cache: config.cache,
    entities: createRecord(),
    onEntity: config.onEntity,
    onField: config.onField,
    path: [],
    optimistic: config.optimistic,
  };

  traverseEntity(ctx, config.entityID, config.type, config.selector);

  return persistEntities(config.cache, ctx.entities, config.optimistic);
}

function traverseEntity(
  ctx: ModifyContext,
  entityID: string,
  type: ValueType,
  selector: SelectorNode | undefined
): void {
  const selectionSet = resolveSelectionSet(selector, type);
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
  if (type) {
    if (isReference(data)) {
      return traverseEntity(ctx, data.___ref, type, selectionSet);
    }

    if (type instanceof UnionType) {
      const resolvedType = type.resolveType(data);
      if (!resolvedType) {
        return;
      }
      type = resolvedType;
    }
  }

  if (isObject(data)) {
    const fields = getSelectionFields(selectionSet, type, data);

    for (const fieldName of Object.keys(fields)) {
      if (!hasOwn(data, fieldName)) {
        continue;
      }

      ctx.path.push(fieldName);

      if (ctx.onField(ctx, data, fields[fieldName]) === false) {
        ctx.path.pop();
        continue;
      }

      if (fields[fieldName].selectionSet) {
        const objectField =
          type instanceof ObjectType ? type.getfield(fieldName) : undefined;

        traverseValue(
          ctx,
          fields[fieldName].selectionSet,
          objectField && objectField.type,
          data[fieldName]
        );
      }

      ctx.path.pop();
    }
  } else if (Array.isArray(data)) {
    const ofType = type instanceof ArrayType ? type.ofType : undefined;
    for (let i = 0; i < data.length; i++) {
      ctx.path.push(i);
      traverseValue(ctx, selectionSet, ofType, data[i]);
      ctx.path.pop();
    }
  }
}
