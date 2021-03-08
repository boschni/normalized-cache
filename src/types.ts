export interface PlainObject {
  ___dummy?: unknown;
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

export interface MissingField {
  path: (string | number)[];
}

export interface InvalidField {
  value: any;
  path: (string | number)[];
}
