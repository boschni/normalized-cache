import { Reference } from "../types";
import { isObject } from "../utils/data";

type MaybeThunk<T> = T | (() => T);

type IdFunction = (value: any) => unknown;

export type WriteFunction<TIncoming = any, TExisting = TIncoming> = (
  incoming: TIncoming,
  existing: TExisting | undefined
) => TExisting;

export interface NonNullableTypeConfig {
  name?: string;
  ofType: ValueType;
  id?: IdFunction;
}

export class NonNullableType {
  name?: string;
  ofType: ValueType;
  id?: IdFunction;

  constructor(config: NonNullableTypeConfig | ValueType) {
    if (isValueType(config)) {
      this.ofType = config;
    } else {
      this.name = config.name;
      this.ofType = config.ofType;
      this.id = config.id;
    }
  }

  isOfType(value: unknown): boolean {
    return value !== undefined && value !== null && this.ofType.isOfType(value);
  }
}

export interface ArrayTypeConfig {
  name?: string;
  ofType?: ValueType;
  write?: WriteFunction;
  id?: IdFunction;
}

export class ArrayType {
  name?: string;
  ofType?: ValueType;
  write?: WriteFunction;
  id?: IdFunction;

  constructor(config?: ArrayTypeConfig | ValueType) {
    if (isValueType(config)) {
      this.ofType = config;
    } else if (config) {
      this.name = config.name;
      this.ofType = config.ofType;
      this.write = config.write;
      this.id = config.id;
    }
  }

  isOfType(value: unknown): boolean {
    return Array.isArray(value);
  }
}

export interface ObjectTypeConfig {
  name?: string;
  fields?: MaybeThunk<
    Record<string, ValueType | ValueType[] | ObjectFieldType>
  >;
  id?: IdFunction;
  isOfType?: (value: any) => boolean;
  write?: WriteFunction;
}

interface ToReferenceOptions {
  type: string;
  id?: unknown;
  data?: unknown;
}

export interface ObjectFieldReadContext {
  toReference: (options: ToReferenceOptions) => Reference | undefined;
}

export interface ObjectFieldWriteContext extends ObjectFieldReadContext {}

export interface ObjectFieldType {
  type?: ValueType;
  arguments?: boolean;
  read?: (parent: any, ctx: ObjectFieldReadContext) => unknown;
  write?: WriteFunction;
}

export class ObjectType {
  name?: string;
  id?: IdFunction;
  write?: WriteFunction;

  _fields?: MaybeThunk<
    Record<string, ValueType | ValueType[] | ObjectFieldType>
  >;
  _resolvedFields?: Record<string, ObjectFieldType>;
  _isOfType?: (value: any) => boolean;

  constructor(config: ObjectTypeConfig = {}) {
    this.name = config.name;
    this.write = config.write;
    this._fields = config.fields;
    this._isOfType = config.isOfType;
    if (config.id) {
      this.id = config.id;
    } else {
      this.id = (value) => (isObject(value) ? value.id : undefined);
    }
  }

  getFields(): Record<string, ObjectFieldType> {
    if (!this._resolvedFields) {
      const fields: Record<string, ObjectFieldType> = {};

      const fieldMap =
        typeof this._fields === "function"
          ? this._fields()
          : this._fields || {};

      for (const fieldName of Object.keys(fieldMap)) {
        const field = fieldMap[fieldName];

        if (isValueType(field)) {
          fields[fieldName] = { type: field };
        } else if (Array.isArray(field)) {
          fields[fieldName] = { type: new ArrayType(field[0]) };
        } else {
          fields[fieldName] = field;
        }
      }

      this._resolvedFields = fields;
    }

    return this._resolvedFields;
  }

  getField(name: string): ObjectFieldType | undefined {
    const fields = this.getFields();

    if (!fields[name]) {
      const index = name.indexOf("(");
      if (index !== -1) {
        const nameWithoutArgs = name.slice(0, index);
        if (fields[nameWithoutArgs] && fields[nameWithoutArgs].arguments) {
          name = nameWithoutArgs;
        }
      }
    }

    return fields[name];
  }

  isOfType(value: unknown): boolean {
    return this._isOfType ? this._isOfType(value) : isObject(value);
  }
}

export interface UnionTypeConfig {
  name?: string;
  types: ValueType[];
  resolveType?: (value: any) => ValueType | undefined;
  id?: IdFunction;
}

export class UnionType {
  name?: string;
  types: ValueType[];
  _resolveType?: (value: any) => ValueType | undefined;
  id?: IdFunction;

  constructor(config: UnionTypeConfig | ValueType[]) {
    if (Array.isArray(config)) {
      this.types = config;
    } else {
      this.name = config.name;
      this.types = config.types;
      this._resolveType = config.resolveType;
      this.id = config.id;
    }
  }

  resolveType(value: unknown): ValueType | undefined {
    let resolvedType;

    if (this._resolveType) {
      resolvedType = this._resolveType(value);
    }

    if (!resolvedType) {
      resolvedType = this.types.find((type) => type.isOfType(value));
    }

    return resolvedType;
  }

  isOfType(value: unknown): boolean {
    return Boolean(this.resolveType(value));
  }
}

export interface StringTypeConfig {
  name?: string;
  const?: string;
  id?: IdFunction;
}

export class StringType {
  name?: string;
  const?: string;
  id?: IdFunction;

  constructor(config?: StringTypeConfig | string) {
    if (typeof config === "string") {
      this.const = config;
    } else if (config) {
      this.name = config.name;
      this.const = config.const;
      this.id = config.id;
    }
  }

  isOfType(value: unknown): boolean {
    return this.const ? value === this.const : typeof value === "string";
  }
}

export interface NumberTypeConfig {
  name?: string;
  const?: number;
  id?: IdFunction;
}

export class NumberType {
  name?: string;
  const?: number;
  id?: IdFunction;

  constructor(config?: NumberTypeConfig | number) {
    if (typeof config === "number") {
      this.const = config;
    } else if (config) {
      this.name = config.name;
      this.const = config.const;
      this.id = config.id;
    }
  }

  isOfType(value: unknown): boolean {
    return this.const ? value === this.const : typeof value === "number";
  }
}

export interface BooleanTypeConfig {
  name?: string;
  const?: boolean;
  id?: IdFunction;
}

export class BooleanType {
  name?: string;
  const?: boolean;
  id?: IdFunction;

  constructor(config?: BooleanTypeConfig | boolean) {
    if (typeof config === "boolean") {
      this.const = config;
    } else if (config) {
      this.name = config.name;
      this.const = config.const;
      this.id = config.id;
    }
  }

  isOfType(value: unknown): boolean {
    return this.const ? value === this.const : typeof value === "boolean";
  }
}

export type ValueType =
  | ArrayType
  | BooleanType
  | NonNullableType
  | NumberType
  | ObjectType
  | StringType
  | UnionType;

export function isArrayType(value: unknown): value is ArrayType {
  return value instanceof ArrayType;
}

export function isBooleanType(value: unknown): value is BooleanType {
  return value instanceof BooleanType;
}

export function isNonNullableType(value: unknown): value is NonNullableType {
  return value instanceof NonNullableType;
}

export function isNumberType(value: unknown): value is NumberType {
  return value instanceof NumberType;
}

export function isObjectType(value: unknown): value is ObjectType {
  return value instanceof ObjectType;
}

export function isStringType(value: unknown): value is StringType {
  return value instanceof StringType;
}

export function isUnionType(value: unknown): value is UnionType {
  return value instanceof UnionType;
}

export function resolveNamedType(type: ValueType): ValueType | undefined {
  if (type.name) {
    return type;
  }

  const unwrappedType = unwrapType(type);

  if (unwrappedType) {
    return resolveNamedType(unwrappedType);
  }
}

export function unwrapType(
  type: ValueType,
  value?: unknown
): ValueType | undefined {
  if (isNonNullableType(type)) {
    return type.ofType;
  } else if (isUnionType(type)) {
    return type.resolveType(value);
  }
}

export function resolveWrappedType(
  type: ValueType,
  value: unknown
): ValueType | undefined {
  const resolvedType = unwrapType(type, value);
  return resolvedType ? resolveWrappedType(resolvedType, value) : type;
}

function isValueType(value: unknown): value is ValueType {
  return (
    isArrayType(value) ||
    isBooleanType(value) ||
    isNonNullableType(value) ||
    isNumberType(value) ||
    isObjectType(value) ||
    isStringType(value) ||
    isUnionType(value)
  );
}

export const schema = {
  array(config?: ArrayTypeConfig | ValueType): ArrayType {
    return new ArrayType(config);
  },
  boolean(config?: BooleanTypeConfig): BooleanType {
    return new BooleanType(config);
  },
  nonNullable(config: NonNullableTypeConfig | ValueType): NonNullableType {
    return new NonNullableType(config);
  },
  number(config?: NumberTypeConfig): NumberType {
    return new NumberType(config);
  },
  object(config?: ObjectTypeConfig): ObjectType {
    return new ObjectType(config);
  },
  string(config?: StringTypeConfig | string): StringType {
    return new StringType(config);
  },
  union(config: UnionTypeConfig | ValueType[]): UnionType {
    return new UnionType(config);
  },
};
