import type { ValueType } from "../schema/types";
import type { Cache } from "../Cache";
import type { DocumentNode } from "../language/ast";
import { executeModify } from "./modify";
import { resolveEntity } from "../utils/cache";

interface DeleteOptions {
  id?: unknown;
  select?: DocumentNode;
}

export interface DeleteResult {
  updatedEntityIDs?: string[];
}

export function executeDelete(
  cache: Cache,
  type: ValueType,
  optimistic: boolean,
  options: DeleteOptions
): DeleteResult {
  const entity = resolveEntity(cache, type, options.id, optimistic);

  if (!entity) {
    return {};
  }

  return executeModify(cache, type, optimistic, {
    entityID: entity.id,
    selector: options.select,
    onEntity: (ctx, visitedEntity, selectionSet) => {
      if (!selectionSet) {
        ctx.entities[visitedEntity.id] = undefined;
        return false;
      }
    },
    onField: (_ctx, parent, field) => {
      if (!field.selectionSet) {
        delete parent[field.name.value];
        return false;
      }
    },
  });
}
