import { Cache, schema } from "..";
import { cql } from "../language/tag";

describe("Delete", () => {
  it("should be able to delete entities", () => {
    const Type = schema.object({ name: "Type" });
    const cache = new Cache({ types: [Type] });
    cache.write({ type: "Type", data: { a: "a" } });
    cache.delete({ type: "Type" });
    const { data } = cache.read({ type: "Type" });
    expect(data).toBeUndefined();
  });

  it("should be able to delete entity fields by selector", () => {
    const Type = schema.object({ name: "Type" });
    const cache = new Cache({ types: [Type] });
    cache.write({ type: "Type", data: { a: "a" } });
    cache.delete({ type: "Type", select: cql`{ a }` });
    const { data } = cache.read({ type: "Type", select: cql`{ a }` });
    expect(data).toEqual({});
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
    const { data } = cache.read({ type: "Type", select: cql`{ a b }` });
    expect(data).toEqual([{ b: "b" }, { b: "b" }]);
  });

  it("should be able to delete nested values by selector", () => {
    const Child = schema.object({ name: "Child" });
    const Parent = schema.object({ name: "Parent", fields: { child: Child } });
    const cache = new Cache({ types: [Parent] });
    cache.write({ type: "Parent", data: { child: { id: "1", a: "a" } } });
    cache.delete({ type: "Parent", select: cql`{ child { a } }` });
    const { data } = cache.read({
      type: "Parent",
      select: cql`{ child { id a } }`,
    });
    expect(data).toEqual({ child: { id: "1" } });
  });

  it("should be able to delete nested references by selector", () => {
    const Child = schema.object({ name: "Child" });
    const Parent = schema.object({ name: "Parent", fields: { child: Child } });
    const cache = new Cache({ types: [Parent] });
    cache.write({ type: "Parent", data: { child: { id: "1", a: "a" } } });
    cache.delete({ type: "Parent", select: cql`{ child }` });
    const { data } = cache.read({
      type: "Parent",
      select: cql`{ child { id a } }`,
    });
    const { data: dataChild } = cache.read({
      type: "Child",
      id: "1",
    });
    expect(data).toEqual({ child: undefined });
    expect(dataChild).toEqual({ id: "1", a: "a" });
  });
});
