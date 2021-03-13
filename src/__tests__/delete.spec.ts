import { Cache, schema } from "..";
import { cql } from "../language/tag";

describe("Delete", () => {
  it("should be able to delete entities", () => {
    const Type = schema.object({ name: "Type" });
    const cache = new Cache({ types: [Type] });
    cache.write({ type: "Type", data: { a: "a" } });
    cache.delete({ type: "Type" });
    const result = cache.read({ type: "Type" });
    expect(result).toBeUndefined();
  });

  it("should be able to delete entity fields by selector", () => {
    const Type = schema.object({ name: "Type" });
    const cache = new Cache({ types: [Type] });
    cache.write({ type: "Type", data: { a: "a" } });
    cache.delete({ type: "Type", select: cql`{ a }` });
    const result = cache.read({ type: "Type", select: cql`{ a }` });
    expect(result!.data).toEqual({});
  });

  it("should be able to delete array fields by selector", () => {
    const Type = schema.array({ name: "Type" });
    const cache = new Cache({ types: [Type] });
    cache.write({
      type: "Type",
      data: [
        { a: "a", b: "b" },
        { a: "a", b: "b" },
      ],
    });
    cache.delete({ type: "Type", select: cql`{ a }` });
    const result = cache.read({ type: "Type", select: cql`{ a b }` });
    expect(result!.data).toEqual([{ b: "b" }, { b: "b" }]);
  });

  it("should be able to delete nested values by selector", () => {
    const Child = schema.object({ name: "Child" });
    const Parent = schema.object({ name: "Parent", fields: { child: Child } });
    const cache = new Cache({ types: [Parent] });
    cache.write({ type: "Parent", data: { child: { id: "1", a: "a" } } });
    cache.delete({ type: "Parent", select: cql`{ child { a } }` });
    const result = cache.read({
      type: "Parent",
      select: cql`{ child { id a } }`,
    });
    expect(result!.data).toEqual({ child: { id: "1" } });
  });

  it("should be able to delete nested references by selector", () => {
    const Child = schema.object({ name: "Child" });
    const Parent = schema.object({ name: "Parent", fields: { child: Child } });
    const cache = new Cache({ types: [Parent] });
    cache.write({ type: "Parent", data: { child: { id: "1", a: "a" } } });
    cache.delete({ type: "Parent", select: cql`{ child }` });
    const resultParent = cache.read({
      type: "Parent",
      select: cql`{ child { id a } }`,
    });
    const resultChild = cache.read({
      type: "Child",
      id: "1",
    });
    expect(resultParent!.data).toEqual({ child: undefined });
    expect(resultChild!.data).toEqual({ id: "1", a: "a" });
  });
});
