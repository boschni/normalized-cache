import { Cache, cql, schema } from "..";
import { ReadResult } from "../operations/read";

describe("Expiration", () => {
  it("should be able to write entities with an expiry date", () => {
    const Type = schema.string({ name: "Type" });
    const cache = new Cache({ types: [Type] });
    cache.write({ type: "Type", data: "a", expiresAt: 0 });
    const result = cache.read({ type: "Type" });
    const expected: Partial<ReadResult> = {
      expiresAt: 0,
      stale: true,
      invalidated: false,
    };
    expect(result).toMatchObject(expected);
  });

  it("should be able to write specific fields with an expiry date", () => {
    const Type = schema.object({ name: "Type" });
    const cache = new Cache({ types: [Type] });
    cache.write({ type: "Type", data: { a: "a" } });
    cache.write({ type: "Type", data: { b: "b" }, expiresAt: 0 });
    const result = cache.read({ type: "Type" });
    const expected: Partial<ReadResult> = {
      expiresAt: 0,
      stale: true,
      invalidated: false,
    };
    expect(result).toMatchObject(expected);
    const result2 = cache.read({ type: "Type", select: cql`{ a }` });
    const expected2: Partial<ReadResult> = {
      expiresAt: -1,
      stale: false,
      invalidated: false,
    };
    expect(result2).toMatchObject(expected2);
  });

  it("should reset entity expiry dates on write", () => {
    const Type = schema.string({ name: "Type" });
    const cache = new Cache({ types: [Type] });
    cache.write({ type: "Type", data: "a", expiresAt: 0 });
    cache.write({ type: "Type", data: "a" });
    const result = cache.read({ type: "Type" });
    const expected: Partial<ReadResult> = {
      expiresAt: -1,
      stale: false,
      invalidated: false,
    };
    expect(result).toMatchObject(expected);
  });

  it("should reset entity field expiry dates on write", () => {
    const Type = schema.object({ name: "Type" });
    const cache = new Cache({ types: [Type] });
    cache.write({ type: "Type", data: { a: "a" }, expiresAt: 1 });
    cache.write({ type: "Type", data: { b: "b" }, expiresAt: 2 });
    cache.write({ type: "Type", data: { b: "b" } });
    const result = cache.read({ type: "Type", select: cql`{ b }` });
    const expected: Partial<ReadResult> = {
      expiresAt: -1,
      stale: false,
      invalidated: false,
    };
    expect(result).toMatchObject(expected);
    const result2 = cache.read({ type: "Type", select: cql`{ a }` });
    const expected2: Partial<ReadResult> = {
      expiresAt: 1,
      stale: true,
      invalidated: false,
    };
    expect(result2).toMatchObject(expected2);
  });
});
