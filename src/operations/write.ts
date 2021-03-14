import {
  isArrayType,
  isObjectType,
  ValueType,
  resolveWrappedType,
} from "../schema/types";
import type {
  EntitiesRecord,
  Entity,
  Reference,
  InvalidField,
  PlainObjectWithMeta,
} from "../types";
import {
  createReference,
  isObjectWithMeta,
  identifyByData,
  identifyById,
  identifyByType,
  isReference,
} from "../utils/cache";
import { createRecord, isObject } from "../utils/data";
import type { Cache } from "../Cache";
import { updateEntities } from "./shared";
import { isValid, maybeGetObjectField } from "../schema/utils";
import { ErrorCode, invariant } from "../utils/invariant";
import {
  DocumentNode,
  FieldNode,
  InlineFragmentNode,
  NodeType,
  SelectionSetNode,
} from "../language/ast";
import {
  createDocument,
  createField,
  createInlineFragment,
  createSelectionSet,
} from "../language/utils";

interface WriteOptions {
  data: unknown;
  expiresAt?: number;
  id?: unknown;
  onlyWriteKnownFields?: boolean;
}

export interface WriteResult {
  entityID: string;
  invalidFields?: InvalidField[];
  selector?: DocumentNode;
  updatedEntityIDs?: string[];
}

interface WriteContext {
  cache: Cache;
  entities: EntitiesRecord;
  expiresAt: number;
  incomingParents: unknown[];
  invalidFields: InvalidField[];
  onlyWriteKnownFields: boolean | undefined;
  optimistic?: boolean;
  path: (string | number)[];
  rootEntityID: string;
}

export function executeWrite(
  cache: Cache,
  type: ValueType,
  optimistic: boolean,
  options: WriteOptions
): WriteResult {
  let entityID;

  if (options.id !== undefined) {
    entityID = identifyById(type, options.id);
  } else if (options.data !== undefined) {
    entityID = identifyByData(type, options.data);
  }

  // Fallback to the type name
  if (!entityID) {
    entityID = identifyByType(type)!;
  }

  const existingEntity = cache.get(entityID, optimistic);

  const ctx: WriteContext = {
    cache,
    entities: createRecord(),
    expiresAt: typeof options.expiresAt === "number" ? options.expiresAt : -1,
    incomingParents: [],
    invalidFields: [],
    optimistic,
    path: [],
    rootEntityID: entityID,
    onlyWriteKnownFields: options.onlyWriteKnownFields,
  };

  const selectionSet = createSelectionSet();

  processIncoming(ctx, type, existingEntity, options.data, selectionSet);

  const updatedEntityIDs = updateEntities(cache, ctx.entities, optimistic);

  const result: WriteResult = {
    entityID,
  };

  if (updatedEntityIDs.length) {
    result.updatedEntityIDs = updatedEntityIDs;
  }

  if (ctx.invalidFields.length) {
    result.invalidFields = ctx.invalidFields;
  }

  if (selectionSet.selections.length) {
    const document = createDocument();
    document.definitions = [selectionSet];
    result.selector = document;
  }

  return result;
}

function processIncoming(
  ctx: WriteContext,
  type: ValueType | undefined,
  existing: unknown,
  incoming: unknown,
  selectionSet: SelectionSetNode
): unknown {
  let entity: Entity | undefined;
  let entityID: string | undefined;
  let entityRef: Reference | undefined;

  if (type) {
    if (!ctx.path.length) {
      entityID = ctx.rootEntityID;
    } else if (type) {
      entityID = identifyByData(type, incoming);
    }

    if (entityID) {
      entity = ctx.entities[entityID];

      if (!entity) {
        const existingEntity = ctx.cache.get(entityID, ctx.optimistic);

        if (existingEntity) {
          entity = { ...existingEntity };
        } else {
          entity = {
            expiresAt: -1,
            id: entityID,
            invalidated: false,
            value: undefined,
          };
        }

        // If the incoming data is an object the expiry dates will be written to the fields
        if (!isObject(incoming)) {
          entity.expiresAt = ctx.expiresAt;
        }

        // Always remove invalidation when writing to an entity
        entity.invalidated = false;
      }

      ctx.entities[entityID] = entity;
      existing = entity.value;
      entityRef = createReference(entityID);
    }

    if (!isValid(type, incoming)) {
      addInvalidField(ctx, incoming);
    }

    type = resolveWrappedType(type, incoming);

    if (isObjectType(type) && type.name) {
      const inlineFragment = createInlineFragment(type.name);
      selectionSet.selections.push(inlineFragment);
      selectionSet = inlineFragment.selectionSet;
    }
  }

  let result = incoming;

  if (isObject(incoming)) {
    if (isCircularEntity(ctx, incoming, entityRef)) {
      return entityRef;
    }

    let resultObj: Reference | PlainObjectWithMeta;

    if (isReference(incoming)) {
      resultObj = incoming;
    } else {
      resultObj = {
        ___invalidated: {},
        ___expiresAt: {},
      };

      const existingObj = isObjectWithMeta(existing) ? existing : undefined;

      for (const fieldName of Object.keys(incoming)) {
        ctx.path.push(fieldName);

        if (shouldWriteField(ctx, type, fieldName)) {
          const objectField = maybeGetObjectField(type, fieldName);

          resultObj.___expiresAt[fieldName] = ctx.expiresAt;
          resultObj.___invalidated[fieldName] = false;

          const existingFieldValue = existingObj && existingObj[fieldName];

          const fieldSelectionSet = createSelectionSet();

          ctx.incomingParents.push(incoming);
          let newFieldValue = processIncoming(
            ctx,
            objectField && objectField.type,
            existingFieldValue,
            incoming[fieldName],
            fieldSelectionSet
          );
          ctx.incomingParents.pop();

          if (objectField && objectField.write) {
            newFieldValue = objectField.write(
              newFieldValue,
              existingFieldValue
            );
          }

          resultObj[fieldName] = newFieldValue;

          const fieldNode = createField(fieldName);

          if (fieldSelectionSet.selections.length) {
            fieldNode.selectionSet = fieldSelectionSet;
          }

          selectionSet.selections.push(fieldNode);
        }

        // Update existing value as the current entity might also have been nested in the current field
        if (entity) {
          existing = entity.value;
        }

        ctx.path.pop();
      }
    }

    if (isObjectType(type) && type.write) {
      resultObj = type.write(resultObj, existing);
    } else if (
      entity &&
      isObjectWithMeta(existing) &&
      isObjectWithMeta(resultObj)
    ) {
      // Entities can be safely merged
      resultObj = {
        ...existing,
        ...resultObj,
        ___expiresAt: {
          ...existing.___expiresAt,
          ...resultObj.___expiresAt,
        },
        ___invalidated: {
          ...existing.___invalidated,
          ...resultObj.___invalidated,
        },
      };
    }

    result = resultObj;
  } else if (Array.isArray(incoming)) {
    if (isCircularEntity(ctx, incoming, entityRef)) {
      return entityRef;
    }

    let resultArray: unknown[] = [];
    const existingArray = Array.isArray(existing) ? existing : undefined;
    const ofType = isArrayType(type) ? type.ofType : undefined;

    for (let i = 0; i < incoming.length; i++) {
      ctx.path.push(i);

      const fieldSelectionSet = createSelectionSet();

      ctx.incomingParents.push(incoming);
      const item = processIncoming(
        ctx,
        ofType,
        existingArray && existingArray[i],
        incoming[i],
        fieldSelectionSet
      );
      ctx.incomingParents.pop();

      resultArray.push(item);
      extendSelectionSet(selectionSet, fieldSelectionSet);

      // Update existing value as the current entity might also have been nested in the current field
      if (entity) {
        existing = entity.value;
      }

      ctx.path.pop();
    }

    if (isArrayType(type) && type.write) {
      resultArray = type.write(resultArray, existing);
    }

    result = resultArray;
  }

  if (entity) {
    entity.value = result;
    result = entityRef;
  }

  return result;
}

function addInvalidField(ctx: WriteContext, value: unknown) {
  ctx.invalidFields.push({ path: [...ctx.path], value });
}

function shouldWriteField(
  ctx: WriteContext,
  type: ValueType | undefined,
  name: string
): boolean {
  if (!ctx.onlyWriteKnownFields || !isObjectType(type)) {
    return true;
  }

  return Boolean(type.getField(name) || !type.getFieldEntries().length);
}

function isCircularEntity(
  ctx: WriteContext,
  incoming: unknown,
  ref: Reference | undefined
): boolean {
  if (ctx.incomingParents.includes(incoming)) {
    invariant(
      ref,
      process.env.NODE_ENV === "production"
        ? ErrorCode.WRITE_CIRCULAR_DATA
        : `Cannot write non-entity data with circular references`
    );

    return true;
  }

  return false;
}

function extendSelectionSet(
  target: SelectionSetNode,
  source: SelectionSetNode
): void {
  for (const sourceSelection of source.selections) {
    let targetSelection: InlineFragmentNode | FieldNode | undefined;

    if (sourceSelection.kind === NodeType.InlineFragment) {
      targetSelection = target.selections.find(
        (selection) =>
          selection.kind === NodeType.InlineFragment &&
          selection.typeCondition!.name.value ===
            sourceSelection.typeCondition!.name.value
      ) as InlineFragmentNode | undefined;
    } else if (sourceSelection.kind === NodeType.Field) {
      targetSelection = target.selections.find(
        (selection) =>
          selection.kind === NodeType.Field &&
          selection.name.value === sourceSelection.name.value
      ) as FieldNode | undefined;
    } else {
      continue;
    }

    if (!targetSelection) {
      target.selections.push(sourceSelection);
    } else if (!targetSelection.selectionSet) {
      targetSelection.selectionSet = sourceSelection.selectionSet;
    } else if (targetSelection.selectionSet && sourceSelection.selectionSet) {
      extendSelectionSet(
        targetSelection.selectionSet,
        sourceSelection.selectionSet
      );
    }
  }
}
