import type { ValueType } from "../schema/types";
import type { Cache } from "../Cache";
import type { DocumentNode } from "../language/ast";
import { isObjectWithMeta, resolveEntity } from "../utils/cache";
import { executeModify } from "./modify";

interface InvalidateOptions {
  id?: unknown;
  select?: DocumentNode;
}

export interface InvalidateResult {
  updatedEntityIDs?: string[];
}

export function executeInvalidate(
  cache: Cache,
  type: ValueType,
  optimistic: boolean,
  options: InvalidateOptions
): InvalidateResult {
  const entity = resolveEntity(cache, type, options.id, optimistic);

  if (!entity) {
    return {};
  }

  return executeModify(cache, type, optimistic, {
    entityID: entity.id,
    selector: options.select,
    onEntity: (_ctx, visitedEntity, selectionSet) => {
      if (!selectionSet) {
        visitedEntity.invalidated = true;
        return false;
      }
    },
    onField: (_ctx, parent, field) => {
      if (!field.selectionSet && isObjectWithMeta(parent)) {
        parent.___invalidated[field.name.value] = true;
        return false;
      }
    },
  });
}
