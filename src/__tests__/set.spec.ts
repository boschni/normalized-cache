import { Cache, schema } from "..";

describe("set", () => {
  it("should be able to manually change the invalidation state", () => {
    const Type = schema.string({ name: "Type" });
    const cache = new Cache({ types: [Type] });
    cache.write({ type: "Type", data: "a" });
    const read1 = cache.read({ type: "Type" });
    const entity = cache.get("Type");
    if (entity) {
      cache.set(entity.id, { ...entity, invalidated: true });
    }
    const read2 = cache.read({ type: "Type" });
    expect(read1.stale).toBe(false);
    expect(read2.stale).toBe(true);
  });
});
