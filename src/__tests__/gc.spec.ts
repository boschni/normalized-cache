import { Cache, schema } from "..";

describe("GC", () => {
  it("should remove entities which are not retained", () => {
    const Type = schema.string({ name: "Type" });
    const cache = new Cache({ types: [Type] });
    cache.write({ type: "Type", data: "a" });
    cache.gc();
    const { data } = cache.read({ type: "Type" });
    expect(data).toBeUndefined();
  });

  it("should remove entities which are referenced in entities which are not retained", () => {
    const Child = schema.object({ name: "Child" });
    const Parent = schema.object({ name: "Parent", fields: { child: Child } });
    const cache = new Cache({ types: [Parent] });
    cache.write({ type: "Parent", data: { child: { id: "1" } } });
    cache.gc();
    const { data } = cache.read({ type: "Child", id: "1" });
    expect(data).toBeUndefined();
  });

  it("should remove unreferenced entities with circular references", () => {
    const Child = schema.object({
      name: "Child",
      fields: () => ({ parent: Parent }),
    });
    const Parent = schema.object({ name: "Parent", fields: { child: Child } });
    const cache = new Cache({ types: [Parent] });
    cache.write({
      type: "Parent",
      data: { id: "1", child: { id: "2", parent: { id: "1" } } },
    });
    cache.gc();
    const result1 = cache.read({ type: "Parent", id: "1" });
    const result2 = cache.read({ type: "Child", id: "1" });
    expect(result1.data).toBeUndefined();
    expect(result2.data).toBeUndefined();
  });

  it("should not remove referenced entities with circular references", () => {
    const Child = schema.object({
      name: "Child",
      fields: () => ({ parent: Parent }),
    });
    const Parent = schema.object({ name: "Parent", fields: { child: Child } });
    const cache = new Cache({ types: [Parent] });
    cache.write({
      type: "Parent",
      data: { id: "1", child: { id: "2", parent: { id: "1" } } },
    });
    cache.retain("Parent:1");
    cache.gc();
    const result1 = cache.read({ type: "Parent", id: "1" });
    const result2 = cache.read({ type: "Child", id: "2" });
    expect(result1.data).toBeDefined();
    expect(result2.data).toBeDefined();
  });

  it("should remove entities which are released", () => {
    const Type = schema.string({ name: "Type" });
    const cache = new Cache({ types: [Type] });
    cache.write({ type: "Type", data: "a" });
    const disposeable = cache.retain("Type");
    const disposeable2 = cache.retain("Type");
    cache.gc();
    const result1 = cache.read({ type: "Type" });
    expect(result1.data).toBe("a");
    disposeable.dispose();
    disposeable.dispose();
    cache.gc();
    const result2 = cache.read({ type: "Type" });
    expect(result2.data).toBe("a");
    disposeable2.dispose();
    cache.gc();
    const result3 = cache.read({ type: "Type" });
    expect(result3.data).toBeUndefined();
  });

  it("should not remove entities which are retained", () => {
    const Type = schema.string({ name: "Type" });
    const cache = new Cache({ types: [Type] });
    cache.write({ type: "Type", data: "a" });
    cache.retain("Type");
    cache.gc();
    const { data } = cache.read({ type: "Type" });
    expect(data).toBe("a");
  });

  it("should not remove entities which are watched", () => {
    const Type = schema.string({ name: "Type" });
    const cache = new Cache({ types: [Type] });
    cache.write({ type: "Type", data: "a" });
    cache.watch({ type: "Type", callback: () => undefined });
    cache.gc();
    const { data } = cache.read({ type: "Type" });
    expect(data).toBe("a");
  });

  it("should not remove entities which are referenced in entities which are retained", () => {
    const Child = schema.object({ name: "Child" });
    const Parent = schema.object({ name: "Parent", fields: { child: Child } });
    const cache = new Cache({ types: [Parent] });
    cache.write({ type: "Parent", data: { child: { id: "1" } } });
    cache.retain("Parent");
    cache.gc();
    const { data } = cache.read({ type: "Child", id: "1" });
    expect(data).toEqual({ id: "1" });
  });
});
