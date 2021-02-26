import type { ValueType } from "../schema/types";
import type { Cache } from "../Cache";
import type { SelectorNode } from "../language/ast";
import { isObjectWithMeta } from "../utils/cache";
import { modify } from "./modify";

export interface InvalidateOptions {
  id?: unknown;
  optimistic?: boolean;
  select?: SelectorNode;
  type: ValueType;
}

export interface InvalidateResult {
  updatedEntityIDs?: string[];
}

export function executeInvalidate(
  cache: Cache,
  options: InvalidateOptions
): InvalidateResult {
  const result: InvalidateResult = {};
  const entity = cache.resolve(options);

  if (!entity) {
    return result;
  }

  const updatedEntityIDs = modify({
    cache,
    optimistic: options.optimistic,
    entityID: entity.id,
    selector: options.select,
    type: options.type,
    onEntity: (_ctx, entity, selectionSet) => {
      if (!selectionSet) {
        entity.invalidated = true;
        return false;
      }
    },
    onField: (_ctx, parent, field) => {
      if (!field.selectionSet && isObjectWithMeta(parent)) {
        parent.___invalidated[field.name.value] = true;
      }
    },
  });

  if (updatedEntityIDs.length) {
    result.updatedEntityIDs = updatedEntityIDs;
  }

  return result;
}
