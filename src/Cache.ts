import type { ValueType } from "./schema/types";
import { getReferencedTypes } from "./schema/utils";
import { executeWrite, WriteResult } from "./operations/write";
import { executeRead, ReadResult } from "./operations/read";
import { createRecord, replaceEqualDeep, hasOwn, isObject } from "./utils/data";
import { ErrorCode, invariant } from "./utils/invariant";
import type { EntitiesRecord, Entity } from "./types";
import type { DocumentNode } from "./language/ast";
import { DeleteResult, executeDelete } from "./operations/delete";
import { executeInvalidate, InvalidateResult } from "./operations/invalidate";
import { serializeSelector } from "./language/serializer";
import {
  identify,
  identifyByData,
  identifyById,
  isMetaKey,
  isReference,
} from "./utils/cache";
import { Disposable } from "./utils/Disposable";
import { Unsubscribable } from "./utils/Unsubscribable";

interface ReadOptions {
  id?: unknown;
  optimistic?: boolean;
  select?: DocumentNode;
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
  select?: DocumentNode;
  type: string;
}

interface InvalidateOptions {
  id?: unknown;
  optimistic?: boolean;
  select?: DocumentNode;
  type: string;
}

interface IdentifyOptions {
  data?: unknown;
  id?: unknown;
  type: string;
}

interface WatchOptions<T = any> extends ReadOptions {
  callback: (
    result: ReadResult<T> | undefined,
    prevResult?: ReadResult<T>
  ) => void;
}

interface Watch {
  entityID: string;
  options: WatchOptions;
  prevResult?: ReadResult;
}

interface CachedReadResult {
  result: ReadResult | undefined;
  invalidated?: boolean;
}

type OptimisticUpdateFn = (cache: Cache) => void;

class OptimisticUpdateDisposable extends Disposable {
  id: number;

  constructor(id: number, disposeFn: () => void) {
    super(disposeFn);
    this.id = id;
  }
}

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
  _entitiesRefCount: Record<string, number>;
  _optimisticEntities: EntitiesRecord;
  _optimisticReadMode: boolean;
  _optimisticWriteMode: boolean;
  _optimisticUpdates: OptimisticUpdate[];
  _optimisticUpdateID: number;
  _types: Record<string, ValueType>;
  _readResults: Record<string, CachedReadResult | undefined>;
  _watches: Watch[];
  _transactions: number;
  _transactionHasEntityUpdate: boolean;
  _transactionHasOptimisticEntityUpdate: boolean;
  _silent: boolean;

  constructor(config: CacheConfig = {}) {
    this._config = config;
    this._entities = createRecord();
    this._entitiesRefCount = createRecord();
    this._optimisticEntities = createRecord();
    this._optimisticReadMode = true;
    this._optimisticWriteMode = false;
    this._optimisticUpdates = [];
    this._optimisticUpdateID = 0;
    this._watches = [];
    this._readResults = createRecord();
    this._types = config.types ? getReferencedTypes(config.types) : {};
    this._transactions = 0;
    this._transactionHasEntityUpdate = false;
    this._transactionHasOptimisticEntityUpdate = false;
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

  set(
    entityID: string,
    entity: Entity | undefined,
    optimistic?: boolean
  ): Entity | undefined {
    const existingEntity = this.get(entityID, optimistic);
    const updatedEntity = replaceEqualDeep(existingEntity, entity);

    if (optimistic) {
      this._optimisticEntities[entityID] = updatedEntity;
    } else {
      this._entities[entityID] = updatedEntity;
    }

    if (updatedEntity !== existingEntity) {
      if (optimistic) {
        handleOptimisticEntityUpdate(this);
      } else {
        handleEntityUpdate(this);
      }
    }

    return updatedEntity;
  }

  read<T>(options: ReadOptions): ReadResult<T> | undefined {
    const type = ensureType(this, options.type);
    const optimistic = shouldReadOptimistic(this, options.optimistic);
    const resultID = getResultID(type, options.select, options.id);
    const cachedResult = this._readResults[resultID];

    if (optimistic && cachedResult && !cachedResult.invalidated) {
      return cachedResult.result;
    }

    let result = executeRead<T>(this, type, optimistic, options);

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
    return executeWrite(this, type, optimistic, options);
  }

  delete(options: DeleteOptions): DeleteResult | undefined {
    const type = ensureType(this, options.type);
    const optimistic = shouldWriteOptimistic(this, options.optimistic);
    return executeDelete(this, type, optimistic, options);
  }

  invalidate(options: InvalidateOptions): InvalidateResult | undefined {
    const type = ensureType(this, options.type);
    const optimistic = shouldWriteOptimistic(this, options.optimistic);
    return executeInvalidate(this, type, optimistic, options);
  }

  watch<T>(options: WatchOptions<T>): Unsubscribable {
    const type = ensureType(this, options.type);
    const entityID = identify(type, options.id)!;
    const prevResult = this.read(options);
    const watch: Watch = { entityID, options, prevResult };
    this._watches.push(watch);
    const retainDisposable = this.retain(entityID);
    return new Unsubscribable(() => {
      retainDisposable.dispose();
      this._watches = this._watches.filter((x) => x !== watch);
    });
  }

  addOptimisticUpdate(
    updateFn: OptimisticUpdateFn
  ): OptimisticUpdateDisposable {
    const id = this._optimisticUpdateID++;
    this._optimisticUpdates.push({ id, updateFn });
    handleOptimisticUpdatesChange(this);
    return new OptimisticUpdateDisposable(id, () => {
      this.removeOptimisticUpdate(id);
    });
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

    if (!this._transactions) {
      const hasUpdates = this._transactionHasEntityUpdate;
      const hasOptimisticUpdates = this._transactionHasOptimisticEntityUpdate;

      this._transactionHasEntityUpdate = false;
      this._transactionHasOptimisticEntityUpdate = false;

      if (hasUpdates) {
        handleEntityUpdate(this);
      } else if (hasOptimisticUpdates) {
        handleOptimisticEntityUpdate(this);
      }
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
  }

  retain(entityID: string): Disposable {
    if (!this._entitiesRefCount[entityID]) {
      this._entitiesRefCount[entityID] = 0;
    }

    this._entitiesRefCount[entityID]++;

    return new Disposable(() => {
      if (this._entitiesRefCount[entityID] > 0) {
        this._entitiesRefCount[entityID]--;
      }
    });
  }

  gc(): void {
    const referencedEntities = createRecord<string, boolean>();

    // Find all entities referenced by retained entities
    for (const entityID of Object.keys(this._entitiesRefCount)) {
      if (this._entitiesRefCount[entityID]) {
        findReferencedEntitiesByEntity(
          this._entities,
          referencedEntities,
          entityID
        );
      }
    }

    const deletedEntities = createRecord<string, boolean>();

    // Delete unreferenced entities
    for (const entityID of Object.keys(this._entities)) {
      if (!referencedEntities[entityID]) {
        deletedEntities[entityID] = true;
        delete this._entities[entityID];
      }
    }

    // Remove read results from deleted entities
    for (const resultID of Object.keys(this._readResults)) {
      const result = this._readResults[resultID]!.result;
      if (result && deletedEntities[result.entityID]) {
        delete this._readResults[resultID];
      }
    }
  }
}

function findReferencedEntitiesByEntity(
  entities: EntitiesRecord,
  referencedEntities: Record<string, boolean>,
  entityID: string
): void {
  if (!entities[entityID] || referencedEntities[entityID]) {
    return;
  }

  referencedEntities[entityID] = true;

  findReferencedEntities(
    entities,
    referencedEntities,
    entities[entityID]!.value
  );
}

function findReferencedEntities(
  entities: EntitiesRecord,
  referencedEntities: Record<string, boolean>,
  value: unknown
): void {
  if (isReference(value)) {
    findReferencedEntitiesByEntity(entities, referencedEntities, value.___ref);
  } else if (isObject(value)) {
    for (const key of Object.keys(value)) {
      if (!isMetaKey(key)) {
        findReferencedEntities(entities, referencedEntities, value[key]);
      }
    }
  } else if (Array.isArray(value)) {
    for (const item of value) {
      findReferencedEntities(entities, referencedEntities, item);
    }
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

function handleEntityUpdate(cache: Cache) {
  if (cache._transactions) {
    cache._transactionHasEntityUpdate = true;
    return;
  }
  rebaseOptimisticUpdates(cache);
  invalidateReadResults(cache);
}

function handleOptimisticEntityUpdate(cache: Cache) {
  if (cache._transactions) {
    cache._transactionHasOptimisticEntityUpdate = true;
    return;
  }
  invalidateReadResults(cache);
}

function invalidateReadResults(cache: Cache) {
  for (const key of Object.keys(cache._readResults)) {
    cache._readResults[key]!.invalidated = true;
  }

  if (!cache._silent) {
    checkWatchers(cache);
  }
}

function rebaseOptimisticUpdates(cache: Cache) {
  cache._optimisticEntities = createRecord();
  cache.transaction(() => {
    for (const update of cache._optimisticUpdates) {
      cache.setOptimisticWriteMode(true);
      update.updateFn(cache);
      cache.setOptimisticWriteMode(false);
    }
  });
}

function checkWatchers(cache: Cache) {
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
  selector?: DocumentNode,
  id?: unknown
): string {
  const entityID = identify(type, id)!;
  return selector ? `${entityID}:${serializeSelector(selector)}` : entityID;
}
