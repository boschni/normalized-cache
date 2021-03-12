import { Cache, schema } from "..";
import { cql } from "../language/tag";

describe("write", () => {
  it("should be able to write singleton entities", () => {
    const Type = schema.string({ name: "Type" });
    const cache = new Cache({ types: [Type] });
    cache.write({ type: "Type", data: "a" });
    const { data } = cache.read({ type: "Type" });
    expect(data).toBe("a");
  });

  it("should be able to write entities with a specific ID", () => {
    const Type = schema.string({ name: "Type" });
    const cache = new Cache({ types: [Type] });
    cache.write({ type: "Type", id: "1", data: "a" });
    const { data } = cache.read({ type: "Type", id: "1" });
    expect(data).toBe("a");
  });

  it("should be able to write entities with an object ID", () => {
    const Type = schema.string({ name: "Type" });
    const cache = new Cache({ types: [Type] });
    cache.write({ type: "Type", id: { page: 1 }, data: "a" });
    const { data } = cache.read({ type: "Type", id: { page: 1 } });
    expect(data).toBe("a");
  });

  it("should be able to write boolean entites", () => {
    const Type = schema.boolean({ name: "Type" });
    const cache = new Cache({ types: [Type] });
    cache.write({ type: "Type", data: true });
    const { data } = cache.read({ type: "Type" });
    expect(data).toBe(true);
  });

  it("should be able to write null entities", () => {
    const Type = schema.string({ name: "Type" });
    const cache = new Cache({ types: [Type] });
    cache.write({ type: "Type", data: null });
    const { data } = cache.read({ type: "Type" });
    expect(data).toBe(null);
  });

  it("should be able to write string entities", () => {
    const Type = schema.string({ name: "Type" });
    const cache = new Cache({ types: [Type] });
    cache.write({ type: "Type", data: "a" });
    const { data } = cache.read({ type: "Type" });
    expect(data).toBe("a");
  });

  it("should be able to write number entities", () => {
    const Type = schema.number({ name: "Type" });
    const cache = new Cache({ types: [Type] });
    cache.write({ type: "Type", data: 1 });
    const { data } = cache.read({ type: "Type" });
    expect(data).toBe(1);
  });

  it("should be able to write undefined entities", () => {
    const Type = schema.string({ name: "Type" });
    const cache = new Cache({ types: [Type] });
    cache.write({ type: "Type", data: undefined });
    const { data } = cache.read({ type: "Type" });
    expect(data).toBe(undefined);
  });

  it("should be able to write object entities", () => {
    const Type = schema.object({ name: "Type" });
    const cache = new Cache({ types: [Type] });
    cache.write({ type: "Type", data: {} });
    const { data } = cache.read({ type: "Type" });
    expect(data).toEqual({});
  });

  it("should be able to write array entities", () => {
    const Type = schema.array({ name: "Type" });
    const cache = new Cache({ types: [Type] });
    cache.write({ type: "Type", data: [] });
    const { data } = cache.read({ type: "Type" });
    expect(data).toEqual([]);
  });

  it("should be able to write undefined values", () => {
    const Type = schema.object({
      name: "Type",
      fields: { value: schema.string() },
    });
    const cache = new Cache({ types: [Type] });
    cache.write({ type: "Type", data: { value: undefined } });
    const { data } = cache.read({ type: "Type" });
    expect(data).toEqual({ value: undefined });
  });

  it("should be able to write null values", () => {
    const Type = schema.object({
      name: "Type",
      fields: { value: schema.string() },
    });
    const cache = new Cache({ types: [Type] });
    cache.write({ type: "Type", data: { value: null } });
    const { data } = cache.read({ type: "Type" });
    expect(data).toEqual({ value: null });
  });

  it("should be able to write boolean values", () => {
    const Type = schema.object({
      name: "Type",
      fields: { value: schema.boolean() },
    });
    const cache = new Cache({ types: [Type] });
    cache.write({ type: "Type", data: { value: false } });
    const { data } = cache.read({ type: "Type" });
    expect(data).toEqual({ value: false });
  });

  it("should be able to write number values", () => {
    const Type = schema.object({
      name: "Type",
      fields: { value: schema.number() },
    });
    const cache = new Cache({ types: [Type] });
    cache.write({ type: "Type", data: { value: 1 } });
    const { data } = cache.read({ type: "Type" });
    expect(data).toEqual({ value: 1 });
  });

  it("should be able to write string values", () => {
    const Type = schema.object({
      name: "Type",
      fields: { value: schema.string() },
    });
    const cache = new Cache({ types: [Type] });
    cache.write({ type: "Type", data: { value: "a" } });
    const { data } = cache.read({ type: "Type" });
    expect(data).toEqual({ value: "a" });
  });

  it("should be able to write object values", () => {
    const Type = schema.object({ name: "Type" });
    const cache = new Cache({ types: [Type] });
    cache.write({ type: "Type", data: { value: { a: "a" } } });
    const { data } = cache.read({ type: "Type" });
    expect(data).toEqual({ value: { a: "a" } });
  });

  it("should be able to write array values", () => {
    const Type = schema.object({ name: "Type" });
    const cache = new Cache({ types: [Type] });
    cache.write({ type: "Type", data: { value: [0, 1, 2] } });
    const { data } = cache.read({ type: "Type" });
    expect(data).toEqual({ value: [0, 1, 2] });
  });

  it("should be able to write references", () => {
    const Child = schema.object({ name: "Child" });
    const Parent = schema.object({ name: "Parent", fields: { child: Child } });
    const cache = new Cache({ types: [Parent] });
    cache.write({ type: "Child", data: { id: "1" } });
    cache.write({ type: "Parent", data: { child: { ___ref: "Child:1" } } });
    const { data } = cache.read({
      type: "Parent",
      select: cql`{ child { id } }`,
    });
    expect(data).toEqual({ child: { id: "1" } });
  });

  it("should normalize nested entities", () => {
    const Child = schema.object({ name: "Child" });
    const Parent = schema.object({ name: "Parent", fields: { child: Child } });
    const cache = new Cache({ types: [Parent] });
    cache.write({ type: "Parent", data: { child: { id: "1" } } });
    const { data } = cache.read({ type: "Child", id: "1" });
    expect(data).toEqual({ id: "1" });
    expect(cache._entities).toMatchObject({
      Parent: { id: "Parent", value: { child: { ___ref: "Child:1" } } },
      "Child:1": { id: "Child:1", value: { id: "1" } },
    });
  });

  it("should normalize nested entities wrapped in a non nullable type", () => {
    const Child = schema.object({ name: "Child" });
    const Parent = schema.object({
      name: "Parent",
      fields: { child: schema.nonNullable(Child) },
    });
    const cache = new Cache({ types: [Parent] });
    cache.write({ type: "Parent", data: { child: { id: "1" } } });
    expect(cache._entities).toMatchObject({
      Parent: { id: "Parent", value: { child: { ___ref: "Child:1" } } },
      "Child:1": { id: "Child:1", value: { id: "1" } },
    });
  });

  it("should normalize input with circular references between entities", () => {
    const Child = schema.object({
      name: "Child",
      fields: () => ({ child: Child }),
    });
    const Parent = schema.object({ name: "Parent", fields: { child: Child } });
    const cache = new Cache({ types: [Parent] });
    const child = { id: "1" } as any;
    child.child = child;
    cache.write({ type: "Parent", data: { child } });
    expect(cache._entities).toMatchObject({
      Parent: { id: "Parent", value: { child: { ___ref: "Child:1" } } },
      "Child:1": {
        id: "Child:1",
        value: { id: "1", child: { ___ref: "Child:1" } },
      },
    });
  });

  it("should warn when normalizing input with circular references between non-entities", () => {
    const Parent = schema.object({
      name: "Parent",
      fields: { child: schema.object() },
    });
    const cache = new Cache({ types: [Parent] });
    const child = { id: "1" } as any;
    child.child = child;
    expect(() => {
      cache.write({ type: "Parent", data: { child } });
    }).toThrow();
  });

  it("should not normalize nested entities if they do not have an ID", () => {
    const Child = schema.object({ name: "Child" });
    const Parent = schema.object({ name: "Parent", fields: { child: Child } });
    const cache = new Cache({ types: [Parent] });
    cache.write({ type: "Parent", data: { child: {} } });
    expect(cache._entities).toMatchObject({
      Parent: { id: "Parent", value: { child: {} } },
    });
  });

  it("should not normalize nested entities if they do not have a type name", () => {
    const Child = schema.object();
    const Parent = schema.object({ name: "Parent", fields: { child: Child } });
    const cache = new Cache({ types: [Parent] });
    cache.write({ type: "Parent", data: { child: { id: "1" } } });
    expect(cache._entities).toMatchObject({
      Parent: { id: "Parent", value: { child: { id: "1" } } },
    });
  });

  it("should not normalize if the incoming data does not match the schema", () => {
    const Child = schema.object();
    const Parent = schema.object({ name: "Parent", fields: { child: Child } });
    const cache = new Cache({ types: [Parent] });
    cache.write({ type: "Parent", data: { child: [{ id: "1" }] } });
    expect(cache._entities).toMatchObject({
      Parent: { id: "Parent", value: { child: [{ id: "1" }] } },
    });
  });

  it("should normalize entities within unions with resolveType", () => {
    const A = schema.object({ name: "A" });
    const B = schema.object({ name: "B" });
    const Parent = schema.array({
      name: "Parent",
      ofType: schema.union({
        types: [A, B],
        resolveType: (value) => (value.type === "A" ? A : B),
      }),
    });
    const cache = new Cache({ types: [Parent] });
    cache.write({
      type: "Parent",
      data: [
        { id: "1", type: "A" },
        { id: "1", type: "B" },
      ],
    });
    expect(cache._entities).toMatchObject({
      Parent: { id: "Parent", value: [{ ___ref: "A:1" }, { ___ref: "B:1" }] },
      "A:1": { id: "A:1", value: { id: "1", type: "A" } },
      "B:1": { id: "B:1", value: { id: "1", type: "B" } },
    });
  });

  it("should normalize entities within unions with isOfType", () => {
    const A = schema.object({
      name: "A",
      isOfType: (value) => value.type === "A",
    });
    const B = schema.object({
      name: "B",
      isOfType: (value) => value.type === "B",
    });
    const Parent = schema.array({
      name: "Parent",
      ofType: schema.union({ types: [A, B] }),
    });
    const cache = new Cache({ types: [Parent] });
    cache.write({
      type: "Parent",
      data: [
        { id: "1", type: "A" },
        { id: "1", type: "B" },
      ],
    });
    expect(cache._entities).toMatchObject({
      Parent: { id: "Parent", value: [{ ___ref: "A:1" }, { ___ref: "B:1" }] },
      "A:1": { id: "A:1", value: { id: "1", type: "A" } },
      "B:1": { id: "B:1", value: { id: "1", type: "B" } },
    });
  });

  it("should merge if the same entity is found multiple times", () => {
    const Child = schema.object({ name: "Child" });
    const Parent = schema.object({
      name: "Parent",
      fields: { child1: Child, child2: Child },
    });
    const cache = new Cache({ types: [Parent] });
    cache.write({
      type: "Parent",
      data: {
        child1: { id: "1", a: "a" },
        child2: { id: "1", b: "b" },
      },
    });
    expect(cache._entities).toMatchObject({
      Parent: {
        id: "Parent",
        value: { child1: { ___ref: "Child:1" }, child2: { ___ref: "Child:1" } },
      },
      "Child:1": { id: "Child:1", value: { id: "1", a: "a", b: "b" } },
    });
  });

  it("should merge if the same entity is found within itself", () => {
    const Child = schema.object({
      name: "Child",
      fields: () => ({ child: Child }),
    });
    const Parent = schema.object({ name: "Parent", fields: { child: Child } });
    const cache = new Cache({ types: [Parent] });
    cache.write({
      type: "Parent",
      data: {
        child: { id: "1", a: "a", child: { id: "1", b: "b" } },
      },
    });
    expect(cache._entities).toMatchObject({
      Parent: { id: "Parent", value: { child: { ___ref: "Child:1" } } },
      "Child:1": {
        id: "Child:1",
        value: { id: "1", a: "a", b: "b", child: { ___ref: "Child:1" } },
      },
    });
  });

  it("should merge existing entities", () => {
    const Child = schema.object({ name: "Child" });
    const Parent = schema.object({ name: "Parent", fields: { child: Child } });
    const cache = new Cache({ types: [Parent] });
    cache.write({ type: "Parent", data: { child: { id: "1", a: "a" } } });
    cache.write({ type: "Parent", data: { child: { id: "1", b: "b" } } });
    expect(cache._entities).toMatchObject({
      Parent: { id: "Parent", value: { child: { ___ref: "Child:1" } } },
      "Child:1": { id: "Child:1", value: { id: "1", a: "a", b: "b" } },
    });
  });

  it("should not merge existing objects without an ID", () => {
    const Child = schema.object({ name: "Child" });
    const Parent = schema.object({ name: "Parent", fields: { child: Child } });
    const cache = new Cache({ types: [Parent] });
    cache.write({ type: "Parent", data: { child: { a: "a" } } });
    cache.write({ type: "Parent", data: { child: { b: "b" } } });
    expect(cache._entities).toMatchObject({
      Parent: { id: "Parent", value: { child: { b: "b" } } },
    });
  });

  it("should not merge existing arrays", () => {
    const Child = schema.object({ name: "Child" });
    const Parent = schema.array({ name: "Parent", ofType: Child });
    const cache = new Cache({ types: [Parent] });
    cache.write({
      type: "Parent",
      data: [
        { id: "1", a: "a" },
        { id: "2", b: "b" },
      ],
    });
    cache.write({ type: "Parent", data: [{ id: "2", b: "b" }] });
    expect(cache._entities).toMatchObject({
      Parent: { id: "Parent", value: [{ ___ref: "Child:2" }] },
      "Child:1": { id: "Child:1", value: { id: "1", a: "a" } },
      "Child:2": { id: "Child:2", value: { id: "2", b: "b" } },
    });
  });

  it("should call user defined write functions on types", () => {
    const Child = schema.object({
      name: "Child",
      write: (a, b) => ({ ...a, ...b }),
    });
    const Parent = schema.object({ name: "Parent", fields: { child: Child } });
    const cache = new Cache({ types: [Parent] });
    cache.write({ type: "Parent", data: { child: { a: "a" } } });
    cache.write({ type: "Parent", data: { child: { b: "b" } } });
    expect(cache._entities).toMatchObject({
      Parent: { id: "Parent", value: { child: { a: "a", b: "b" } } },
    });
  });

  it("should call nested user defined write functions on types", () => {
    const SubChild = schema.object({
      write: (incoming, existing) => ({ ...existing, ...incoming }),
    });
    const Child = schema.object({
      name: "Child",
      write: (incoming, existing) => ({ ...existing, ...incoming }),
      fields: {
        subChild: SubChild,
      },
    });
    const Parent = schema.object({ name: "Parent", fields: { child: Child } });
    const cache = new Cache({ types: [Parent] });
    cache.write({
      type: "Parent",
      data: { child: { a: "a", subChild: { a: "a" } } },
    });
    cache.write({
      type: "Parent",
      data: { child: { b: "b", subChild: { b: "b" } } },
    });
    expect(cache._entities).toMatchObject({
      Parent: {
        id: "Parent",
        value: { child: { a: "a", b: "b", subChild: { a: "a", b: "b" } } },
      },
    });
  });

  it("should call user defined write functions on fields", () => {
    const Child = schema.object({
      name: "Child",
      fields: {
        a: {
          write: (incoming) => `In:${incoming}`,
        },
      },
    });
    const Parent = schema.object({ name: "Parent", fields: { child: Child } });
    const cache = new Cache({ types: [Parent] });
    cache.write({ type: "Parent", data: { child: { a: "a" } } });
    expect(cache._entities).toMatchObject({
      Parent: { id: "Parent", value: { child: { a: "In:a" } } },
    });
  });

  it("should be able to replace an entity with a write function", () => {
    const Child = schema.object({
      name: "Child",
      write: (incoming) => incoming,
    });
    const Parent = schema.object({ name: "Parent", fields: { child: Child } });
    const cache = new Cache({ types: [Parent] });
    cache.write({ type: "Parent", data: { child: { a: "a" } } });
    cache.write({ type: "Parent", data: { child: { b: "b" } } });
    expect(cache._entities).toMatchObject({
      Parent: { id: "Parent", value: { child: { b: "b" } } },
    });
  });

  it("should share structures if new writes are similar", () => {
    const Child = schema.object({ name: "Child" });
    const Parent = schema.object({ name: "Parent", fields: { child: Child } });
    const cache = new Cache({ types: [Parent] });
    cache.write({ type: "Parent", data: { child: { a: "a" } } });
    const { data: result1 } = cache.read({ type: "Parent" });
    cache.write({ type: "Parent", data: { child: { a: "a" } } });
    const { data: result2 } = cache.read({ type: "Parent" });
    expect(result1).toBe(result2);
  });

  it("should be able to write optimistic data", () => {
    const Child = schema.object({ name: "Child" });
    const Parent = schema.object({ name: "Parent", fields: { child: Child } });
    const cache = new Cache({ types: [Parent] });
    cache.write({ type: "Parent", data: { child: { id: "1", a: "a" } } });
    cache.write({
      type: "Parent",
      data: { child: { id: "1", b: "b" } },
      optimistic: true,
    });
    expect(cache._entities).toMatchObject({
      Parent: { id: "Parent", value: { child: { ___ref: "Child:1" } } },
      "Child:1": { id: "Child:1", value: { id: "1", a: "a" } },
    });
    expect(cache._optimisticEntities).toMatchObject({
      Parent: { id: "Parent", value: { child: { ___ref: "Child:1" } } },
      "Child:1": { id: "Child:1", value: { id: "1", a: "a", b: "b" } },
    });
  });

  it("should be write optimistically by default when optimistic mode is enabled", () => {
    const Child = schema.object({ name: "Child" });
    const Parent = schema.object({ name: "Parent", fields: { child: Child } });
    const cache = new Cache({ types: [Parent] });
    cache.write({ type: "Parent", data: { child: { id: "1", a: "a" } } });
    cache.setOptimisticWriteMode(true);
    cache.write({ type: "Parent", data: { child: { id: "1", b: "b" } } });
    expect(cache._optimisticEntities).toMatchObject({
      Parent: { id: "Parent", value: { child: { ___ref: "Child:1" } } },
      "Child:1": { id: "Child:1", value: { id: "1", a: "a", b: "b" } },
    });
  });

  it("should be able to add an entity to an array of entities", () => {
    const Child = schema.object({ name: "Child" });
    const Parent = schema.array({ name: "Parent", ofType: Child });
    const cache = new Cache({ types: [Parent] });
    cache.write({
      type: "Parent",
      data: [
        { id: "1", a: "a" },
        { id: "2", b: "b" },
      ],
    });
    const read1 = cache.read<any[]>({ type: "Parent", select: cql`{ id }` });
    cache.write({
      type: "Parent",
      data: [...read1.data!, { id: "3", c: "c" }],
    });
    const read2 = cache.read({ type: "Parent" });
    expect(read2.data).toEqual([
      { id: "1", a: "a" },
      { id: "2", b: "b" },
      { id: "3", c: "c" },
    ]);
  });

  it("should be able to write fields with arguments", () => {
    const Parent = schema.object({ name: "Parent" });
    const cache = new Cache({ types: [Parent] });
    cache.write({
      type: "Parent",
      data: { 'child({"id":1})': { id: "1", a: "a" } },
    });
    expect(cache._entities).toMatchObject({
      Parent: {
        id: "Parent",
        value: { 'child({"id":1})': { id: "1", a: "a" } },
      },
    });
  });

  it("should normalize entities within fields with arguments", () => {
    const Child = schema.object({ name: "Child" });
    const Parent = schema.object({
      name: "Parent",
      fields: {
        child: { type: Child, arguments: true },
      },
    });
    const cache = new Cache({ types: [Parent] });
    cache.write({
      type: "Parent",
      data: { 'child({"id":1})': { id: "1", a: "a" } },
    });
    expect(cache._entities).toMatchObject({
      Parent: {
        id: "Parent",
        value: { 'child({"id":1})': { ___ref: "Child:1" } },
      },
      "Child:1": { id: "Child:1", value: { id: "1", a: "a" } },
    });
  });

  it("should not normalize entities within fields with arguments if args is not set", () => {
    const Child = schema.object({ name: "Child" });
    const Parent = schema.object({
      name: "Parent",
      fields: { child: Child },
    });
    const cache = new Cache({ types: [Parent] });
    cache.write({
      type: "Parent",
      data: { 'child({"id":1})': { id: "1", a: "a" } },
    });
    expect(cache._entities).toMatchObject({
      Parent: {
        id: "Parent",
        value: { 'child({"id":1})': { id: "1", a: "a" } },
      },
    });
  });

  it("should not return a selector if the entity is not selectable", () => {
    const Type = schema.string({ name: "Type" });
    const cache = new Cache({ types: [Type] });
    const { selector } = cache.write({ type: "Type", data: "a" });
    expect(selector).toBeUndefined();
  });

  it("should return a selector matching the input shape", () => {
    const Type = schema.object({ name: "Type" });
    const cache = new Cache({ types: [Type] });
    const data = { a: "a" };
    const { selector } = cache.write({ type: "Type", data });
    const result = cache.read({ type: "Type", select: selector });
    expect(result.data).toEqual(data);
    expect(result.invalidFields).toBeUndefined();
    expect(result.missingFields).toBeUndefined();
  });

  it("should return a selector matching the combined input shape in arrays", () => {
    const Type = schema.object({ name: "Type" });
    const cache = new Cache({ types: [Type] });
    const data = { array: [{ a: "a" }, { b: "b" }] };
    const { selector } = cache.write({ type: "Type", data });
    const result = cache.read({ type: "Type", select: selector });
    expect(result.data).toEqual(data);
    expect(result.invalidFields).toBeUndefined();
    expect(result.missingFields).toEqual([
      { path: ["array", 0, "b"] },
      { path: ["array", 1, "a"] },
    ]);
  });

  it("should return a selector matching the individual input shape in arrays", () => {
    const A = schema.object({ name: "A", isOfType: (value) => value?.a });
    const B = schema.object({ name: "B", isOfType: (value) => value?.b });
    const Type = schema.object({
      name: "Type",
      fields: {
        array: schema.array(schema.union([A, B])),
      },
    });
    const cache = new Cache({ types: [Type] });
    const data = { array: [{ a: "a" }, { b: "b" }] };
    const { selector } = cache.write({ type: "Type", data });
    const result = cache.read({ type: "Type", select: selector });
    expect(result.data).toEqual(data);
    expect(result.invalidFields).toBeUndefined();
    expect(result.missingFields).toBeUndefined();
  });

  it("should return a selector which only selects the input fields from related entities", () => {
    const A = schema.object({ name: "A" });
    const Type = schema.object({
      name: "Type",
      fields: {
        a1: A,
        a2: A,
      },
    });
    const cache = new Cache({ types: [Type] });
    cache.write({ type: "A", id: "1", data: { id: "1", aa: "aa" } });
    const data = { a1: { id: "1", a: "a" }, a2: { id: "2", b: "b" } };
    const { selector } = cache.write({ type: "Type", data });
    const result = cache.read({ type: "Type", select: selector });
    expect(result.data).toEqual(data);
    expect(result.invalidFields).toBeUndefined();
    expect(result.missingFields).toBeUndefined();
  });

  it("should return a selector which only selects the input fields from related entities in arrays", () => {
    const A = schema.object({
      name: "A",
      fields: {
        id: schema.string(),
        a: schema.string(),
        aa: schema.string(),
        b: schema.string(),
      },
    });
    const Type = schema.object({
      name: "Type",
      fields: {
        array: [A],
      },
    });
    const cache = new Cache({ types: [Type] });
    cache.write({ type: "A", id: "1", data: { id: "1", aa: "aa" } });
    const data = {
      array: [
        { id: "1", a: "a" },
        { id: "2", b: "b" },
      ],
    };
    const { selector } = cache.write({ type: "Type", data });
    const result = cache.read({ type: "Type", select: selector });
    expect(result.data).toEqual(data);
    expect(result.invalidFields).toBeUndefined();
    expect(result.missingFields).toEqual([
      { path: ["array", 0, "b"] },
      { path: ["array", 1, "a"] },
    ]);
  });
});
