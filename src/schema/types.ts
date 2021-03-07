import { isObject } from "../utils/data";

type MaybeThunk<T> = T | (() => T);

export type MergeFunction<TExisting = any, TIncoming = TExisting> = (
  existing: TExisting | undefined,
  incoming: TIncoming
) => TExisting;

export interface NonNullableTypeConfig {
  name?: string;
  ofType: ValueType;
}

export class NonNullableType {
  name?: string;
  ofType: ValueType;

  constructor(config: NonNullableTypeConfig | ValueType) {
    if (isValueType(config)) {
      this.ofType = config;
    } else {
      this.name = config.name;
      this.ofType = config.ofType;
    }
  }

  isOfType(value: unknown): boolean {
    return value !== undefined && value !== null && this.ofType.isOfType(value);
  }
}

export interface ArrayTypeConfig {
  name?: string;
  ofType?: ValueType;
  merge?: MergeFunction;
}

export class ArrayType {
  name?: string;
  ofType?: ValueType;
  merge?: MergeFunction;

  constructor(config?: ArrayTypeConfig | ValueType) {
    if (isValueType(config)) {
      this.ofType = config;
    } else if (config) {
      this.name = config.name;
      this.ofType = config.ofType;
      this.merge = config.merge;
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
  id?: (value: any) => unknown;
  isOfType?: (value: any) => boolean;
  merge?: MergeFunction;
}

export interface ObjectFieldType {
  type: ValueType;
  arguments?: boolean;
}

export class ObjectType {
  name?: string;
  fields?: MaybeThunk<
    Record<string, ValueType | ValueType[] | ObjectFieldType>
  >;
  id?: (value: any) => unknown;
  merge?: MergeFunction;

  _fields?: Record<string, ObjectFieldType>;
  _isOfType?: (value: any) => boolean;

  constructor(config: ObjectTypeConfig = {}) {
    this.name = config.name;
    this.fields = config.fields;
    this.id = config.id;
    this.merge = config.merge;
    this._isOfType = config.isOfType;
  }

  getFields(): Record<string, ObjectFieldType> {
    if (!this._fields) {
      const fields: Record<string, ObjectFieldType> = {};

      const fieldMap =
        typeof this.fields === "function" ? this.fields() : this.fields || {};

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

      return (this._fields = fields);
    }

    return this._fields;
  }

  getfield(name: string): ObjectFieldType | undefined {
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
}

export class UnionType {
  name?: string;
  types: ValueType[];
  _resolveType?: (value: any) => ValueType | undefined;

  constructor(config: UnionTypeConfig | ValueType[]) {
    if (Array.isArray(config)) {
      this.types = config;
    } else {
      this.name = config.name;
      this.types = config.types;
      this._resolveType = config.resolveType;
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
}

export class StringType {
  name?: string;
  const?: string;

  constructor(config?: StringTypeConfig | string) {
    if (typeof config === "string") {
      this.const = config;
    } else if (config) {
      this.name = config.name;
      this.const = config.const;
    }
  }

  isOfType(value: unknown): boolean {
    return this.const ? value === this.const : typeof value === "string";
  }
}

export interface NumberTypeConfig {
  name?: string;
  const?: number;
}

export class NumberType {
  name?: string;
  const?: number;

  constructor(config?: NumberTypeConfig | number) {
    if (typeof config === "number") {
      this.const = config;
    } else if (config) {
      this.name = config.name;
      this.const = config.const;
    }
  }

  isOfType(value: unknown): boolean {
    return this.const ? value === this.const : typeof value === "number";
  }
}

export interface BooleanTypeConfig {
  name?: string;
  const?: boolean;
}

export class BooleanType {
  name?: string;
  const?: boolean;

  constructor(config?: BooleanTypeConfig | boolean) {
    if (typeof config === "boolean") {
      this.const = config;
    } else if (config) {
      this.name = config.name;
      this.const = config.const;
    }
  }

  isOfType(value: unknown): boolean {
    return this.const ? value === this.const : typeof value === "boolean";
  }
}

export interface NullTypeConfig {
  name?: string;
}

export class NullType {
  name?: string;

  constructor(config?: NullTypeConfig) {
    if (config) {
      this.name = config.name;
    }
  }

  isOfType(value: unknown): boolean {
    return value === null;
  }
}

export type ValueType =
  | ArrayType
  | BooleanType
  | NonNullableType
  | NullType
  | NumberType
  | ObjectType
  | StringType
  | UnionType;

function isValueType(value: unknown): value is ValueType {
  return (
    value instanceof ArrayType ||
    value instanceof BooleanType ||
    value instanceof NonNullableType ||
    value instanceof NullType ||
    value instanceof NumberType ||
    value instanceof ObjectType ||
    value instanceof StringType ||
    value instanceof UnionType
  );
}

export const schema = {
  array(config?: ArrayTypeConfig | ValueType): ArrayType {
    return new ArrayType(config);
  },
  boolean(config?: BooleanTypeConfig): BooleanType {
    return new BooleanType(config);
  },
  null(config?: NullTypeConfig): NullType {
    return new NullType(config);
  },
  number(config?: NumberTypeConfig): NumberType {
    return new NumberType(config);
  },
  nonNullable(config: NonNullableTypeConfig | ValueType): NonNullableType {
    return new NonNullableType(config);
  },
  object(config?: ObjectTypeConfig): ObjectType {
    return new ObjectType(config);
  },
  union(config: UnionTypeConfig | ValueType[]): UnionType {
    return new UnionType(config);
  },
  string(config?: StringTypeConfig | string): StringType {
    return new StringType(config);
  },
};
