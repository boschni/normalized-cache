import {
  isArrayType,
  isObjectType,
  ValueType,
  resolveWrappedType,
} from "../schema/types";
import type { EntitiesRecord, Entity, Reference, InvalidField } from "../types";
import {
  createReference,
  isObjectWithMeta,
  identifyByData,
  identifyById,
  identifyByType,
  isReference,
} from "../utils/cache";
import { createRecord, isObject, hasOwn } from "../utils/data";
import type { Cache } from "../Cache";
import { updateEntities } from "./shared";
import { isValid, maybeGetFieldType } from "../schema/utils";

interface WriteOptions {
  data: unknown;
  expiresAt?: number;
  id?: unknown;
  strict?: boolean;
}

export interface WriteResult {
  invalidFields?: InvalidField[];
  updatedEntityIDs?: string[];
}

interface WriteContext {
  cache: Cache;
  entities: EntitiesRecord;
  expiresAt: number;
  incomingParents: unknown[];
  invalidFields: InvalidField[];
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
  };

  processIncoming(ctx, type, existingEntity, options.data);

  let updatedEntityIDs: string[] = [];

  // In strict mode only persist when the data is valid
  if (!ctx.invalidFields.length || !options.strict) {
    updatedEntityIDs = updateEntities(cache, ctx.entities, optimistic);
  }

  const result: WriteResult = {};

  if (updatedEntityIDs.length) {
    result.updatedEntityIDs = updatedEntityIDs;
  }

  if (ctx.invalidFields.length) {
    result.invalidFields = ctx.invalidFields;
  }

  return result;
}

function processIncoming(
  ctx: WriteContext,
  type: ValueType | undefined,
  existing: unknown,
  incoming: unknown
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
  }

  let result = incoming;

  if (isObject(incoming)) {
    // Try handling circular references in the incoming data
    if (ctx.incomingParents.includes(incoming)) {
      return entityRef || incoming;
    }

    // Validate fields which are defined in the schema but not present in the incoming data
    if (isObjectType(type)) {
      const fields = type.getFields();
      for (const name of Object.keys(fields)) {
        if (
          !hasOwn(incoming, name) &&
          !isValid(fields[name].type, incoming[name])
        ) {
          ctx.path.push(name);
          addInvalidField(ctx, incoming[name]);
          ctx.path.pop();
        }
      }
    }

    const existingObj = isObjectWithMeta(existing) ? existing : undefined;
    let resultObj: any;

    if (isReference(incoming)) {
      resultObj = incoming;
    } else {
      resultObj = {
        ___invalidated: {},
        ___expiresAt: {},
      };

      for (const key of Object.keys(incoming)) {
        ctx.path.push(key);
        ctx.incomingParents.push(incoming);

        resultObj.___expiresAt[key] = ctx.expiresAt;
        resultObj.___invalidated[key] = false;

        const typeField = maybeGetFieldType(type, key);
        const existingFieldValue = existingObj && existingObj[key];

        let newFieldValue = processIncoming(
          ctx,
          typeField && typeField.type,
          existingFieldValue,
          incoming[key]
        );

        if (typeField && typeField.write) {
          newFieldValue = typeField.write(newFieldValue, existingFieldValue);
        }

        resultObj[key] = newFieldValue;

        ctx.incomingParents.pop();
        ctx.path.pop();
      }
    }

    if (isObjectType(type) && type.write) {
      resultObj = type.write(resultObj, existing);
    } else if (entity && isObjectWithMeta(entity.value)) {
      // Entities can be safely merged
      resultObj = {
        ...entity.value,
        ...resultObj,
        ___expiresAt: {
          ...entity.value.___expiresAt,
          ...resultObj.___expiresAt,
        },
        ___invalidated: {
          ...entity.value.___invalidated,
          ...resultObj.___invalidated,
        },
      };
    }

    result = resultObj;
  } else if (Array.isArray(incoming)) {
    // Try handling circular references in the incoming data
    if (ctx.incomingParents.includes(incoming)) {
      return entityRef || incoming;
    }

    let resultArray: unknown[] = [];
    const existingArray = Array.isArray(existing) ? existing : undefined;
    const ofType = isArrayType(type) ? type.ofType : undefined;

    for (let i = 0; i < incoming.length; i++) {
      ctx.path.push(i);
      ctx.incomingParents.push(incoming);
      resultArray.push(
        processIncoming(
          ctx,
          ofType,
          existingArray && existingArray[i],
          incoming[i]
        )
      );
      ctx.incomingParents.pop();
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
