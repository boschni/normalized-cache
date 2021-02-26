import { NonNullableType, SchemaKind, ValueType } from "./types";
import { createRecord } from "../utils/data";

export function isValid(type: ValueType | undefined, value: unknown): boolean {
  return !type ||
    (!(type instanceof NonNullableType) &&
      (value === undefined || value === null))
    ? true
    : type.isOfType(value);
}

export function getReferencedTypes(
  types: ValueType[]
): Record<string, ValueType> {
  const record = createRecord<string, ValueType>();

  for (const type of types) {
    visitTypes(type, {
      enter: (visited) => {
        if (visited.name) {
          if (record[visited.name]) {
            return false;
          }
          record[visited.name] = visited;
        }
      },
    });
  }

  return record;
}

interface VisitConfig {
  enter: (type: ValueType) => boolean | void;
}

export function visitTypes(
  type: ValueType,
  config: VisitConfig
): boolean | undefined {
  if (config.enter(type) === false) {
    return;
  }

  switch (type.kind) {
    case SchemaKind.Object: {
      const fields = type.getFields();
      for (const field of Object.keys(fields)) {
        visitTypes(fields[field].type, config);
      }
      break;
    }
    case SchemaKind.Array: {
      if (type.ofType) {
        visitTypes(type.ofType, config);
      }
      break;
    }
    case SchemaKind.Union: {
      for (const unionType of type.types) {
        visitTypes(unionType, config);
      }
      break;
    }
    case SchemaKind.NonNullable:
      {
        visitTypes(type.ofType, config);
      }
      break;
  }
}
