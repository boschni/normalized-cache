import type { Cache } from "../Cache";
import {
  FieldNode,
  DocumentNode,
  NodeType,
  SelectionSetNode,
  FragmentDefinitionNode,
} from "../language/ast";
import { isObjectType, ValueType } from "../schema/types";
import type { EntitiesRecord, PlainObject } from "../types";
import { isMetaKey } from "../utils/cache";
import { ErrorCode, invariant } from "../utils/invariant";

export function getSelectionSet(
  node: DocumentNode | undefined,
  type: ValueType | undefined
): SelectionSetNode | undefined {
  if (node) {
    const selector = node.definitions[0];

    if (selector.kind === NodeType.FragmentDefinition) {
      invariant(
        !type || selector.typeCondition.name.value === type.name,
        process.env.NODE_ENV === "production"
          ? ErrorCode.SELECTOR_SCHEMA_MISMATCH
          : `The fragment type "${selector.typeCondition.name.value}" does not match the schema type "${type?.name}"`
      );
      return selector.selectionSet;
    }

    return selector;
  }
}

export function getSelectionFields(
  document: DocumentNode | undefined,
  selectionSet: SelectionSetNode | undefined,
  type: ValueType | undefined,
  data: PlainObject,
  fields: Record<string, FieldNode> = {}
): Record<string, FieldNode> {
  if (document && selectionSet) {
    for (const selection of selectionSet.selections) {
      if (selection.kind === NodeType.InlineFragment) {
        if (
          !selection.typeCondition ||
          (type && type.name === selection.typeCondition.name.value)
        ) {
          getSelectionFields(
            document,
            selection.selectionSet,
            type,
            data,
            fields
          );
        }
      } else if (selection.kind === NodeType.Star) {
        addAllFields(fields, type, data);
      } else if (selection.kind === NodeType.FragmentSpread) {
        const fragDefinition = document.definitions.find(
          (def) =>
            def.kind === NodeType.FragmentDefinition &&
            def.name.value === selection.name.value
        ) as FragmentDefinitionNode | undefined;

        invariant(
          fragDefinition,
          process.env.NODE_ENV === "production"
            ? ErrorCode.SELECTOR_SCHEMA_MISMATCH
            : `Fragment "${selection.name.value}" not found"`
        );

        if (type && type.name === fragDefinition.typeCondition.name.value) {
          getSelectionFields(
            document,
            fragDefinition.selectionSet,
            type,
            data,
            fields
          );
        }
      } else {
        fields[selection.name.value] = selection;
      }
    }
  } else {
    addAllFields(fields, type, data);
  }

  return fields;
}

function addAllFields(
  fields: Record<string, FieldNode>,
  type: ValueType | undefined,
  data: PlainObject
) {
  for (const key of Object.keys(data)) {
    if (!isMetaKey(key)) {
      fields[key] = {
        kind: NodeType.Field,
        name: { kind: NodeType.Name, value: key },
      };
    }
  }
  if (isObjectType(type)) {
    const typeFields = type.getFields();
    for (const key of Object.keys(typeFields)) {
      fields[key] = {
        kind: NodeType.Field,
        name: { kind: NodeType.Name, value: key },
      };
    }
  }
}

export function updateEntities(
  cache: Cache,
  entities: EntitiesRecord,
  optimistic: boolean | undefined
): string[] {
  const updatedEntityIDs: string[] = [];

  cache.transaction(() => {
    for (const entityID of Object.keys(entities)) {
      const existingEntity = cache.get(entityID, optimistic);
      const updatedEntity = cache.set(entityID, entities[entityID], optimistic);
      if (updatedEntity !== existingEntity) {
        updatedEntityIDs.push(entityID);
      }
    }
  });

  return updatedEntityIDs;
}
