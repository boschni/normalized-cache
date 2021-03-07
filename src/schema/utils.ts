import {
  ArrayType,
  NonNullableType,
  ObjectType,
  UnionType,
  ValueType,
} from "./types";
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

  if (type instanceof ObjectType) {
    const fields = type.getFields();
    for (const field of Object.keys(fields)) {
      visitTypes(fields[field].type, config);
    }
  } else if (type instanceof ArrayType) {
    if (type.ofType) {
      visitTypes(type.ofType, config);
    }
  } else if (type instanceof UnionType) {
    for (const unionType of type.types) {
      visitTypes(unionType, config);
    }
  } else if (type instanceof NonNullableType) {
    visitTypes(type.ofType, config);
  }
}
