import { Cache, schema } from "..";

describe("Identify", () => {
  it("should be able to identify by string id", () => {
    const A = schema.object({ name: "A" });
    const cache = new Cache({ types: [A] });
    const entityID = cache.identify({ type: "A", id: "1" });
    expect(entityID).toBe("A:1");
  });

  it("should be able to identify by object id", () => {
    const A = schema.object({ name: "A" });
    const cache = new Cache({ types: [A] });
    const entityID = cache.identify({ type: "A", id: { page: 1 } });
    expect(entityID).toBe(`A:{"page":1}`);
  });

  it("should be able to identify objects by data", () => {
    const A = schema.object({
      name: "A",
      id: (value) => value?.uid,
    });
    const cache = new Cache({ types: [A] });
    const entityID = cache.identify({
      type: "A",
      data: { uid: "1" },
    });
    expect(entityID).toBe("A:1");
  });

  it("should be able to identify unions by data", () => {
    const A = schema.object({
      name: "A",
      isOfType: (value) => value?.type === "A",
    });
    const B = schema.object({
      name: "B",
      isOfType: (value) => value?.type === "B",
    });
    const Type = schema.union({ name: "Type", types: [A, B] });
    const cache = new Cache({ types: [Type] });
    const entityID = cache.identify({
      type: "Type",
      data: { type: "B", id: "1" },
    });
    expect(entityID).toBe("B:1");
  });

  it("should not identify undefined values", () => {
    const A = schema.object({
      name: "A",
      isOfType: (value) => value?.type === "A",
    });
    const cache = new Cache({ types: [A] });
    const entityID = cache.identify({ type: "A", data: undefined });
    expect(entityID).toBe(undefined);
  });

  it("should not identify on invalid data", () => {
    const A = schema.object({
      name: "A",
      isOfType: (value) => value?.type === "A",
    });
    const cache = new Cache({ types: [A] });
    const entityID = cache.identify({
      type: "A",
      data: { type: "A" },
    });
    expect(entityID).toBe(undefined);
  });
});
