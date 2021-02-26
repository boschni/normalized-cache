import { ArrayType, ObjectType, UnionType, ValueType } from "../schema/types";
import type {
  EntitiesRecord,
  Entity,
  Ref,
  InvalidField,
  PlainObjectWithMeta,
} from "../types";
import {
  ensureEntityID,
  identify,
  createReference,
  isObjectWithMeta,
} from "../utils/cache";
import { createRecord, isObject, hasOwn } from "../utils/data";
import type { Cache } from "../Cache";
import { persistEntities } from "./shared";
import { isValid } from "../schema/utils";

interface WriteOptions {
  data: any;
  expiresAt?: number;
  id?: unknown;
  optimistic?: boolean;
  strict?: boolean;
  type: ValueType;
}

export interface WriteResult {
  invalidFields?: InvalidField[];
  updatedEntityIDs?: string[];
}

interface WriteContext {
  cache: Cache;
  entities: EntitiesRecord;
  expiresAt: number;
  incomingParents: any[];
  invalidFields: InvalidField[];
  optimistic?: boolean;
  path: (string | number)[];
  rootEntityID: string;
}

export function executeWrite(cache: Cache, options: WriteOptions): WriteResult {
  const entityID = ensureEntityID(options.type, options.id, options.data);
  const existingEntity = cache.get(entityID, options.optimistic);

  const ctx: WriteContext = {
    cache,
    entities: createRecord(),
    expiresAt: typeof options.expiresAt === "number" ? options.expiresAt : -1,
    incomingParents: [],
    invalidFields: [],
    optimistic: options.optimistic,
    path: [],
    rootEntityID: entityID,
  };

  processIncoming(ctx, options.type, existingEntity, options.data);

  let updatedEntityIDs: string[] = [];

  // In strict mode only persist when the data is valid
  if (!ctx.invalidFields.length || !options.strict) {
    updatedEntityIDs = persistEntities(cache, ctx.entities, options.optimistic);
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
  let entityRef: Ref | undefined;

  // Try to resolve unions
  if (type instanceof UnionType) {
    type = type.resolveType(incoming);
    if (!type) {
      addInvalidField(ctx, incoming);
    }
  }

  if (type && type.name) {
    if (!ctx.path.length) {
      entityID = ctx.rootEntityID;
    } else {
      entityID = identify({ type, data: incoming, strict: true });
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

        entity.expiresAt = isObject(incoming) ? -1 : ctx.expiresAt;
        entity.invalidated = false;
      }

      ctx.entities[entityID] = entity;
      existing = entity.value;
      entityRef = createReference(entityID);
    }
  }

  // Check if the value matches the schema
  if (!isValid(type, incoming)) {
    addInvalidField(ctx, incoming);
    type = undefined;
  }

  let result = incoming;

  if (isObject(incoming)) {
    // Try handling circular references in the incoming data
    if (ctx.incomingParents.includes(incoming)) {
      return entityRef || incoming;
    }

    // Validate fields which are defined in the schema but not present in the incoming data
    if (type instanceof ObjectType) {
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

    let resultObj: PlainObjectWithMeta = {
      ___invalidated: {},
      ___expiresAt: {},
    };

    for (const key of Object.keys(incoming)) {
      ctx.path.push(key);
      ctx.incomingParents.push(incoming);

      resultObj.___expiresAt[key] = ctx.expiresAt;
      resultObj.___invalidated[key] = false;

      const fieldType =
        type instanceof ObjectType ? type.getfield(key)?.type : undefined;

      resultObj[key] = processIncoming(
        ctx,
        fieldType,
        existingObj && existingObj[key],
        incoming[key]
      );

      ctx.incomingParents.pop();
      ctx.path.pop();
    }

    if (type instanceof ObjectType && type.merge) {
      resultObj = type.merge(existing, resultObj);
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
    const ofType = type instanceof ArrayType ? type.ofType : undefined;

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

    if (type instanceof ArrayType && type.merge) {
      resultArray = type.merge(existing, resultArray);
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
