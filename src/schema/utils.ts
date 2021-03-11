import {
  isArrayType,
  isNonNullableType,
  isObjectType,
  isUnionType,
  ObjectFieldType,
  ValueType,
} from "./types";
import { createRecord } from "../utils/data";

export function isValid(type: ValueType | undefined, value: unknown): boolean {
  if (
    !type ||
    ((value === undefined || value === null) && !isNonNullableType(type))
  ) {
    return true;
  }

  return type.isOfType(value);
}

export function maybeGetFieldType(
  type: ValueType | undefined,
  fieldName: string
): ObjectFieldType | undefined {
  if (isObjectType(type)) {
    return type.getField(fieldName);
  }
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

  if (isObjectType(type)) {
    const fields = type.getFields();
    for (const field of Object.keys(fields)) {
      const fieldType = fields[field].type;
      if (fieldType) {
        visitTypes(fieldType, config);
      }
    }
  } else if (isArrayType(type)) {
    if (type.ofType) {
      visitTypes(type.ofType, config);
    }
  } else if (isUnionType(type)) {
    for (const unionType of type.types) {
      visitTypes(unionType, config);
    }
  } else if (isNonNullableType(type)) {
    visitTypes(type.ofType, config);
  }
}
