export { cql } from "./language/tag";
export { Cache } from "./Cache";
export { schema } from "./schema/types";

export type {
  CacheConfig,
  DeleteOptions,
  IdentifyOptions,
  InvalidateOptions,
  ReadOptions,
  WatchOptions,
  WriteOptions,
} from "./Cache";
export type { DeleteResult } from "./operations/delete";
export type { InvalidateResult } from "./operations/invalidate";
export type { ReadResult } from "./operations/read";
export type { WriteResult } from "./operations/write";
