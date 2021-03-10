export interface PlainObject {
  ___dummy?: unknown;
  [key: string]: unknown;
}

export interface PlainObjectWithMeta {
  ___expiresAt: Record<string, number>;
  ___invalidated: Record<string, boolean>;
  [key: string]: unknown;
}

export interface Entity {
  expiresAt: number;
  id: string;
  invalidated: boolean;
  value: unknown;
}

export interface Reference {
  ___ref: string;
}

export type EntitiesRecord = Record<string, Entity | undefined>;

export interface MissingField {
  path: (string | number)[];
}

export interface InvalidField {
  value: any;
  path: (string | number)[];
}
