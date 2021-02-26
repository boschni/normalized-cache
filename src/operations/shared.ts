import type { Cache } from "../Cache";
import {
  FieldNode,
  SelectorNode,
  NodeType,
  SelectionSetNode,
} from "../language/ast";
import type { ValueType } from "../schema/types";
import type { EntitiesRecord, PlainObject } from "../types";
import { replaceEqualDeep } from "../utils/data";
import { ErrorCode, invariant } from "../utils/invariant";

export function resolveSelectionSet(
  selector: SelectorNode | undefined,
  type: ValueType
): SelectionSetNode | undefined {
  if (selector && selector.kind === NodeType.FragmentDefinition) {
    invariant(
      selector.typeCondition.name.value === type.name,
      process.env.NODE_ENV === "production"
        ? ErrorCode.SELECTOR_SCHEMA_MISMATCH
        : `The fragment type "${selector.typeCondition.name.value}" does not match the schema type "${type.name}"`
    );
    return selector.selectionSet;
  }
  return selector;
}

export function getSelectionFields(
  selectionSet: SelectionSetNode | undefined,
  type: ValueType | undefined,
  data: PlainObject
): Record<string, FieldNode> {
  const fields: Record<string, FieldNode> = {};

  if (selectionSet) {
    for (const selection of selectionSet.selections) {
      if (selection.kind === NodeType.InlineFragment) {
        if (
          !selection.typeCondition ||
          (type && type.name === selection.typeCondition.name.value)
        ) {
          for (const fragSelection of selection.selectionSet.selections) {
            if (fragSelection.kind === NodeType.Field) {
              fields[fragSelection.name.value] = fragSelection;
            }
          }
        }
      } else if (selection.kind === NodeType.Star) {
        addAllFields(fields, data);
      } else {
        fields[selection.name.value] = selection;
      }
    }
  } else {
    addAllFields(fields, data);
  }

  return fields;
}

function addAllFields(fields: Record<string, FieldNode>, data: PlainObject) {
  for (const key of Object.keys(data)) {
    if (key !== "___expiresAt" && key !== "___invalidated") {
      fields[key] = {
        kind: NodeType.Field,
        name: { kind: NodeType.Name, value: key },
      };
    }
  }
}

export function persistEntities(
  cache: Cache,
  entities: EntitiesRecord,
  optimistic: boolean | undefined
): string[] {
  const updatedEntityIDs: string[] = [];

  for (const entityID of Object.keys(entities)) {
    const existingEntity = cache.get(entityID, optimistic);
    const entity = replaceEqualDeep(existingEntity, entities[entityID]);

    if (entity !== existingEntity) {
      updatedEntityIDs.push(entityID);
    }

    if (optimistic) {
      cache._optimisticEntities[entityID] = entity;
    } else {
      cache._entities[entityID] = entity;
    }
  }

  return updatedEntityIDs;
}
