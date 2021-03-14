import { Cache, schema } from "..";

describe("restore", () => {
  it("should be able to extract and restore the cache", () => {
    const Type = schema.object({ name: "Type" });
    const cache = new Cache({ types: [Type] });
    cache.write({ type: "Type", data: { id: "1", a: "a" } });
    cache.write({ type: "Type", data: { id: "1", a: "b" }, optimistic: true });
    const data = cache.extract();
    const cache2 = new Cache({ types: [Type] });
    cache2.restore(data);
    const result1 = cache2.read({ type: "Type", id: "1" });
    const result2 = cache2.read({ type: "Type", id: "1", optimistic: false });
    expect(result1!.data).toEqual({ id: "1", a: "a" });
    expect(result2!.data).toEqual({ id: "1", a: "a" });
  });

  it("should be able to extract and restore the cache including optimistic data", () => {
    const Type = schema.object({ name: "Type" });
    const cache = new Cache({ types: [Type] });
    cache.write({ type: "Type", data: { id: "1", a: "a" } });
    cache.write({ type: "Type", data: { id: "1", a: "b" }, optimistic: true });
    const data = cache.extract(true);
    const cache2 = new Cache({ types: [Type] });
    cache2.restore(data);
    const result1 = cache2.read({ type: "Type", id: "1" });
    const result2 = cache2.read({ type: "Type", id: "1", optimistic: false });
    expect(result1!.data).toEqual({ id: "1", a: "b" });
    expect(result2!.data).toEqual({ id: "1", a: "a" });
  });
});
