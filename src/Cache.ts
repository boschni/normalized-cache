import type { ValueType } from "./schema/types";
import { getReferencedTypes } from "./schema/utils";
import { executeWrite, WriteResult } from "./operations/write";
import { executeRead, ReadResult } from "./operations/read";
import { createRecord, replaceEqualDeep, hasOwn } from "./utils/data";
import { ErrorCode, invariant } from "./utils/invariant";
import type { EntitiesRecord, Entity } from "./types";
import type { SelectorNode } from "./language/ast";
import { DeleteResult, executeDelete } from "./operations/delete";
import { executeInvalidate, InvalidateResult } from "./operations/invalidate";
import { serializeSelector } from "./language/serializer";
import { identifyByData, identifyById, identifyByType } from "./utils/cache";

interface ReadOptions {
  id?: unknown;
  optimistic?: boolean;
  select?: SelectorNode;
  type: string;
}

interface WriteOptions {
  data: unknown;
  expiresAt?: number;
  id?: unknown;
  optimistic?: boolean;
  strict?: boolean;
  type: string;
}

interface DeleteOptions {
  id?: unknown;
  optimistic?: boolean;
  select?: SelectorNode;
  type: string;
}

interface InvalidateOptions {
  id?: unknown;
  optimistic?: boolean;
  select?: SelectorNode;
  type: string;
}

interface IdentifyOptions {
  data?: unknown;
  id?: unknown;
  type: string;
}

interface WatchOptions<T = any> extends ReadOptions {
  callback: (result: ReadResult<T>, prevResult?: ReadResult<T>) => void;
}

interface Watch {
  options: WatchOptions;
  prevResult?: ReadResult;
}

interface CachedReadResult {
  result: ReadResult;
  invalidated?: boolean;
}

type OptimisticUpdateFn = (cache: Cache) => void;

type UnsubscribeFn = () => void;

interface OptimisticUpdate {
  id: number;
  updateFn: OptimisticUpdateFn;
}

export interface CacheConfig {
  /**
   * The schema types. All referenced types will be automatically added.
   */
  types?: ValueType[];
  /**
   * If enabled, only valid data will be returned from the cache.
   */
  strictReadTypeChecks?: boolean;
  /**
   * If enabled, only fields known to the schema will be returned from the cache.
   */
  strictReadFieldChecks?: boolean;
  /**
   * If enabled, only valid data will be written to the cache.
   */
  strictWriteTypeChecks?: boolean;
  /**
   * If enabled, only fields known to the schema will be written to the cache.
   */
  strictWriteFieldChecks?: boolean;
}

export class Cache {
  _config: CacheConfig;
  _entities: EntitiesRecord;
  _optimisticEntities: EntitiesRecord;
  _optimisticReadMode: boolean;
  _optimisticWriteMode: boolean;
  _optimisticUpdates: OptimisticUpdate[];
  _optimisticUpdateID: number;
  _types: Record<string, ValueType>;
  _readResults: Record<string, CachedReadResult | undefined>;
  _watches: Watch[];
  _transactions: number;
  _shouldUpdateWatchers: boolean;
  _silent: boolean;

  constructor(config: CacheConfig = {}) {
    this._config = config;
    this._entities = createRecord();
    this._optimisticEntities = createRecord();
    this._optimisticReadMode = true;
    this._optimisticWriteMode = false;
    this._optimisticUpdates = [];
    this._optimisticUpdateID = 0;
    this._watches = [];
    this._readResults = createRecord();
    this._types = config.types ? getReferencedTypes(config.types) : {};
    this._transactions = 0;
    this._shouldUpdateWatchers = false;
    this._silent = false;
  }

  /**
   * Use this method to put the cache enable or disable the optimistc write mode.
   * All writes/deletes will be optimistic by default when the optimistic mode is enabled.
   */
  setOptimisticWriteMode(value: boolean): void {
    this._optimisticWriteMode = value;
  }

  identify(options: IdentifyOptions): string | undefined {
    const type = ensureType(this, options.type);
    if (options.id !== undefined) {
      return identifyById(type, options.id);
    } else if (options.data !== undefined) {
      return identifyByData(type, options.data);
    }
  }

  get(entityID: string, optimistic?: boolean): Entity | undefined {
    return shouldReadOptimistic(this, optimistic) &&
      hasOwn(this._optimisticEntities, entityID)
      ? this._optimisticEntities[entityID]
      : this._entities[entityID];
  }

  set(entity: Entity, optimistic?: boolean): Entity {
    const existingEntity = this.get(entity.id, optimistic);
    const updatedEntity = replaceEqualDeep(existingEntity, entity);

    if (updatedEntity !== entity) {
      if (optimistic) {
        this._optimisticEntities[updatedEntity.id] = updatedEntity;
      } else {
        this._entities[updatedEntity.id] = updatedEntity;
      }
      handleUpdatedEntities(this, optimistic);
    }

    return updatedEntity;
  }

  read<T>(options: ReadOptions): ReadResult<T> {
    const type = ensureType(this, options.type);
    const optimistic = shouldReadOptimistic(this, options.optimistic);
    const resultID = getResultID(type, options.select, options.id);
    const cachedResult = this._readResults[resultID];

    if (optimistic && cachedResult && !cachedResult.invalidated) {
      return cachedResult.result;
    }

    let result = executeRead<T>(this, { ...options, type, optimistic });

    // Only optimistic results are cached as non-optimistic reads should not occur often
    if (optimistic) {
      if (cachedResult) {
        result = replaceEqualDeep(cachedResult.result, result);
      }
      this._readResults[resultID] = { result };
    }

    return result;
  }

  write(options: WriteOptions): WriteResult {
    const type = ensureType(this, options.type);
    const optimistic = shouldWriteOptimistic(this, options.optimistic);
    const result = executeWrite(this, { ...options, type, optimistic });

    if (result.updatedEntityIDs) {
      handleUpdatedEntities(this, optimistic);
    }

    return result;
  }

  delete(options: DeleteOptions): DeleteResult {
    const type = ensureType(this, options.type);
    const optimistic = shouldWriteOptimistic(this, options.optimistic);
    const result = executeDelete(this, { ...options, type, optimistic });

    if (result.updatedEntityIDs) {
      handleUpdatedEntities(this, optimistic);
    }

    return result;
  }

  invalidate(options: InvalidateOptions): InvalidateResult {
    const type = ensureType(this, options.type);
    const optimistic = shouldWriteOptimistic(this, options.optimistic);
    const result = executeInvalidate(this, { ...options, type, optimistic });

    if (result.updatedEntityIDs) {
      handleUpdatedEntities(this, optimistic);
    }

    return result;
  }

  watch<T>(options: WatchOptions<T>): UnsubscribeFn {
    const prevResult = this.read(options);
    const watch: Watch = { options, prevResult };
    this._watches.push(watch);
    return () => {
      this._watches = this._watches.filter((x) => x !== watch);
    };
  }

  addOptimisticUpdate(updateFn: OptimisticUpdateFn): number {
    const id = this._optimisticUpdateID++;
    this._optimisticUpdates.push({ id, updateFn });
    handleOptimisticUpdatesChange(this);
    return id;
  }

  removeOptimisticUpdate(id: number): void {
    this._optimisticUpdates = this._optimisticUpdates.filter(
      (x) => x.id !== id
    );
    handleOptimisticUpdatesChange(this);
  }

  removeOptimisticUpdates(): void {
    this._optimisticUpdates = [];
    handleOptimisticUpdatesChange(this);
  }

  transaction(fn: () => void): void {
    this._transactions++;
    fn();
    this._transactions--;
    if (!this._transactions && this._shouldUpdateWatchers) {
      this._shouldUpdateWatchers = false;
      updateWatchers(this);
    }
  }

  silent(fn: () => void): void {
    this._silent = true;
    fn();
    this._silent = false;
  }

  reset(): void {
    this._entities = createRecord();
    this._optimisticEntities = createRecord();
    this._readResults = createRecord();
    this._optimisticUpdates = [];
    handleUpdatedEntities(this, false);
  }
}

function shouldReadOptimistic(
  cache: Cache,
  optimistic: boolean | undefined
): boolean {
  return typeof optimistic === "boolean"
    ? optimistic
    : cache._optimisticReadMode;
}

function shouldWriteOptimistic(
  cache: Cache,
  optimistic: boolean | undefined
): boolean {
  return typeof optimistic === "boolean"
    ? optimistic
    : cache._optimisticWriteMode;
}

function handleOptimisticUpdatesChange(cache: Cache) {
  rebaseOptimisticUpdates(cache);
  invalidateReadResults(cache);
}

function handleUpdatedEntities(cache: Cache, optimistic: boolean | undefined) {
  if (!optimistic) {
    rebaseOptimisticUpdates(cache);
  }
  invalidateReadResults(cache);
}

function rebaseOptimisticUpdates(cache: Cache) {
  cache._optimisticEntities = {};
  cache.transaction(() => {
    for (const update of cache._optimisticUpdates) {
      cache.setOptimisticWriteMode(true);
      update.updateFn(cache);
      cache.setOptimisticWriteMode(false);
    }
  });
}

function invalidateReadResults(cache: Cache) {
  for (const key of Object.keys(cache._readResults)) {
    cache._readResults[key]!.invalidated = true;
  }

  if (!cache._silent) {
    if (cache._transactions) {
      cache._shouldUpdateWatchers = true;
    } else {
      updateWatchers(cache);
    }
  }
}

function updateWatchers(cache: Cache) {
  for (const watch of cache._watches) {
    const prevResult = watch.prevResult;
    const result = cache.read(watch.options);
    if (result !== prevResult) {
      watch.prevResult = result;
      watch.options.callback(result, prevResult);
    }
  }
}

function ensureType(cache: Cache, typeName: string): ValueType {
  const type = cache._types[typeName];

  invariant(
    type,
    process.env.NODE_ENV === "production"
      ? ErrorCode.TYPE_NOT_FOUND
      : `Type ${typeName} not found`
  );

  return type;
}

function getResultID(
  type: ValueType,
  selector?: SelectorNode,
  id?: unknown
): string {
  const entityID =
    id !== undefined ? identifyById(type, id)! : identifyByType(type)!;
  return selector ? `${entityID}:${serializeSelector(selector)}` : entityID;
}
