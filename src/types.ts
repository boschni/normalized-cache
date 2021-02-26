type Primitive = string | number | boolean | null | undefined;

export interface PlainObject {
  dummy?: unknown;
  [key: string]: unknown;
}

export interface PlainObjectWithMeta {
  ___expiresAt: Record<string, number>;
  ___invalidated: Record<string, boolean>;
  [key: string]: unknown;
}

type EntityID = string;

export interface Entity {
  expiresAt: number;
  id: EntityID;
  invalidated: boolean;
  value: unknown;
}

export interface Ref {
  ___ref: EntityID;
}

export type EntitiesRecord = Record<EntityID, Entity | undefined>;

// eslint-disable-next-line @typescript-eslint/ban-types
export type SafeReadonly<T> = T extends object ? Readonly<T> : T;

export interface Variables {
  [name: string]: Primitive | Array<Primitive | Variables>;
}

export interface FieldInfo {
  key: string;
  name: string;
  args?: Variables;
}

export interface MissingField {
  path: (string | number)[];
}

export interface InvalidField {
  value: any;
  path: (string | number)[];
}
