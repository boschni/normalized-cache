import { Cache, schema } from "..";
import { cql } from "../language/tag";
import { InvalidateResult } from "../operations/invalidate";

describe("Invalidation", () => {
  it("should invalidate an entity when no selector is given", () => {
    const Type = schema.object({ name: "Type" });
    const cache = new Cache({ types: [Type] });
    cache.write({ type: "Type", data: { a: "a", b: "b" } });
    const invalidateResult = cache.invalidate({ type: "Type" });
    expect(invalidateResult).toEqual({ updatedEntityIDs: ["Type"] });
    const result1 = cache.read({ type: "Type" });
    expect(result1!.stale).toBe(true);
    expect(result1!.invalidated).toBe(true);
    const result2 = cache.read({ type: "Type", select: cql`{ a }` });
    expect(result2!.invalidated).toBe(true);
    const result3 = cache.read({ type: "Type", select: cql`{ b }` });
    expect(result3!.invalidated).toBe(true);
  });

  it("should remove invalidation when writing to an entity", () => {
    const Type = schema.string({ name: "Type" });
    const cache = new Cache({ types: [Type] });
    cache.write({ type: "Type", data: "a" });
    cache.invalidate({ type: "Type" });
    cache.write({ type: "Type", data: "a" });
    const readResult = cache.read({ type: "Type" });
    expect(readResult!.stale).toBe(false);
    expect(readResult!.invalidated).toBe(false);
  });

  it("should be able to invalidate all entity fields", () => {
    const Type = schema.object({ name: "Type" });
    const cache = new Cache({ types: [Type] });
    cache.write({ type: "Type", data: { a: "a", b: "b" } });
    const invalidateResult = cache.invalidate({
      type: "Type",
      select: cql`{ * }`,
    });
    expect(invalidateResult).toEqual({ updatedEntityIDs: ["Type"] });
    const result1 = cache.read({ type: "Type" });
    expect(result1!.invalidated).toBe(true);
    const result2 = cache.read({ type: "Type", select: cql`{ a }` });
    expect(result2!.invalidated).toBe(true);
    const result3 = cache.read({ type: "Type", select: cql`{ b }` });
    expect(result3!.invalidated).toBe(true);
  });

  it("should be able to invalidate an entity field", () => {
    const Type = schema.object({ name: "Type" });
    const cache = new Cache({ types: [Type] });
    cache.write({ type: "Type", data: { a: "a", b: "b" } });
    const invalidateResult = cache.invalidate({
      type: "Type",
      select: cql`{ a }`,
    });
    expect(invalidateResult).toEqual({ updatedEntityIDs: ["Type"] });
    const result1 = cache.read({ type: "Type" });
    expect(result1!.invalidated).toBe(true);
    const result2 = cache.read({ type: "Type", select: cql`{ a }` });
    expect(result2!.invalidated).toBe(true);
    const result3 = cache.read({ type: "Type", select: cql`{ b }` });
    expect(result3!.invalidated).toBe(false);
  });

  it("should not invalidate nested entities when all fields are selected", () => {
    const Child = schema.object({ name: "Child" });
    const Type = schema.object({ name: "Type", fields: { child: Child } });
    const cache = new Cache({ types: [Type] });
    cache.write({ type: "Type", data: { child: { id: "1", a: { a: "a" } } } });
    const result = cache.invalidate({
      type: "Type",
      select: cql`{ * }`,
    });
    const expected: InvalidateResult = {
      updatedEntityIDs: ["Type"],
    };
    expect(result).toEqual(expected);
    const result2 = cache.read({
      type: "Type",
      select: cql`{ child }`,
    });
    expect(result2!.invalidated).toBe(true);
    const result3 = cache.read({
      type: "Child",
      id: "1",
    });
    expect(result3!.invalidated).toBe(false);
  });

  it("should be able to invalidate a nested entity field", () => {
    const Child = schema.object({ name: "Child" });
    const Type = schema.object({ name: "Type", fields: { child: Child } });
    const cache = new Cache({ types: [Type] });
    cache.write({ type: "Type", data: { child: { id: "1", a: { a: "a" } } } });
    const result = cache.invalidate({
      type: "Type",
      select: cql`{ child { a } }`,
    });
    const expected: InvalidateResult = {
      updatedEntityIDs: ["Child:1"],
    };
    expect(result).toEqual(expected);
    const result2 = cache.read({
      type: "Type",
      select: cql`{ child }`,
    });
    expect(result2!.invalidated).toBe(true);
    const result3 = cache.read({
      type: "Child",
      id: "1",
      select: cql`{ id }`,
    });
    expect(result3!.invalidated).toBe(false);
    const result4 = cache.read({
      type: "Child",
      id: "1",
      select: cql`{ a }`,
    });
    expect(result4!.invalidated).toBe(true);
  });

  it("should be able to invalidate nested fields unknown to the schema", () => {
    const Type = schema.object({ name: "Type" });
    const cache = new Cache({ types: [Type] });
    cache.write({ type: "Type", data: { a: { b: "b" } } });
    const result = cache.invalidate({
      type: "Type",
      select: cql`{ a { b } }`,
    });
    const expected: InvalidateResult = {
      updatedEntityIDs: ["Type"],
    };
    expect(result).toEqual(expected);
    const result2 = cache.read({
      type: "Type",
      select: cql`{ a }`,
    });
    expect(result2!.invalidated).toBe(true);
  });

  it("should be able to invalidate object fields within arrays", () => {
    const Type = schema.array({ name: "Type", ofType: schema.object() });
    const cache = new Cache({ types: [Type] });
    cache.write({
      type: "Type",
      data: [
        { c: "c", d: "d" },
        { a: "a", b: "b" },
      ],
    });
    const invalidateResult = cache.invalidate({
      type: "Type",
      select: cql`{ a }`,
    });
    expect(invalidateResult).toEqual({ updatedEntityIDs: ["Type"] });
    const result1 = cache.read({ type: "Type" });
    expect(result1!.invalidated).toBe(true);
    const result2 = cache.read({ type: "Type", select: cql`{ a }` });
    expect(result2!.invalidated).toBe(true);
    const result3 = cache.read({ type: "Type", select: cql`{ b }` });
    expect(result3!.invalidated).toBe(false);
  });

  it("should remove invalidating state when deleting and inserting", () => {
    const Type = schema.object({ name: "Type" });
    const cache = new Cache({ types: [Type] });
    cache.write({ type: "Type", data: { a: "a", b: "b" } });
    cache.delete({ type: "Type", select: cql`{ a }` });
    cache.invalidate({ type: "Type", select: cql`{ a }` });
    const result1 = cache.read({ type: "Type", select: cql`{ a }` });
    expect(result1!.invalidated).toBe(false);
    cache.write({ type: "Type", data: { a: "a" } });
    const result2 = cache.read({ type: "Type", select: cql`{ a }` });
    expect(result2!.invalidated).toBe(false);
  });
});
