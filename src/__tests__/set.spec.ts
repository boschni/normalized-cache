import { Cache, schema } from "..";

describe("set", () => {
  it("should be able to manually change the invalidation state", () => {
    const Type = schema.string({ name: "Type" });
    const cache = new Cache({ types: [Type] });
    cache.write({ type: "Type", data: "a" });
    const result1 = cache.read({ type: "Type" });
    const entity = cache.get("Type");
    if (entity) {
      cache.set(entity.id, { ...entity, invalidated: true });
    }
    const result2 = cache.read({ type: "Type" });
    expect(result1!.stale).toBe(false);
    expect(result2!.stale).toBe(true);
  });
});
