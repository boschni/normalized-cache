import { Cache, cql, schema } from "..";

describe("Read", () => {
  it("should be able to read a primtive", () => {
    const Type = schema.string({ name: "Type" });
    const cache = new Cache({ types: [Type] });
    cache.write({ type: "Type", data: "a" });
    const result = cache.read({ type: "Type" });
    expect(result!.data).toBe("a");
  });

  it("should be able to read a single field with a selector", () => {
    const Type = schema.object({ name: "Type" });
    const cache = new Cache({ types: [Type] });
    cache.write({ type: "Type", data: { a: "a", b: "b" } });
    const result = cache.read({ type: "Type", select: cql`{ a }` });
    expect(result!.data).toEqual({ a: "a" });
  });

  it("should be able to read multiple fields with a selector", () => {
    const Type = schema.object({ name: "Type" });
    const cache = new Cache({ types: [Type] });
    cache.write({ type: "Type", data: { a: "a", b: "b" } });
    const result = cache.read({ type: "Type", select: cql`{ a b }` });
    expect(result!.data).toEqual({ a: "a", b: "b" });
  });

  it("should be able to read fields with spaces with a selector", () => {
    const Type = schema.object({ name: "Type" });
    const cache = new Cache({ types: [Type] });
    cache.write({ type: "Type", data: { "a a": "a", b: "b" } });
    const result = cache.read({ type: "Type", select: cql`{ "a a" b }` });
    expect(result!.data).toEqual({ "a a": "a", b: "b" });
  });

  it("should be able to read all fields with the star selector", () => {
    const Type = schema.object({ name: "Type" });
    const cache = new Cache({ types: [Type] });
    cache.write({ type: "Type", data: { a: "a", b: "b" } });
    const result = cache.read({ type: "Type", select: cql`{ * }` });
    expect(result!.data).toEqual({ a: "a", b: "b" });
  });

  it("should be able to read a specific nested field with a selector", () => {
    const Type = schema.object({ name: "Type" });
    const cache = new Cache({ types: [Type] });
    cache.write({ type: "Type", data: { a: { aa: "aa", bb: "bb" } } });
    const result = cache.read({
      type: "Type",
      select: cql`{ a { aa } }`,
    });
    expect(result!.data).toEqual({ a: { aa: "aa" } });
  });

  it("should be able to read all nested fields with a selector", () => {
    const Type = schema.object({ name: "Type" });
    const cache = new Cache({ types: [Type] });
    cache.write({ type: "Type", data: { a: { aa: "aa", bb: "bb" } } });
    const result = cache.read({
      type: "Type",
      select: cql`{ a { aa bb } }`,
    });
    expect(result!.data).toEqual({ a: { aa: "aa", bb: "bb" } });
  });

  it("should return an empty object if all nested fields are missing", () => {
    const Type = schema.object({ name: "Type" });
    const cache = new Cache({ types: [Type] });
    cache.write({ type: "Type", data: { a: { aa: "aa" } } });
    const result = cache.read({
      type: "Type",
      select: cql`{ a { bb } }`,
    });
    expect(result!.data).toEqual({ a: {} });
  });

  it("should be able to read nested arrays", () => {
    const Type = schema.object({ name: "Type", fields: { a: schema.array() } });
    const cache = new Cache({ types: [Type] });
    cache.write({ type: "Type", data: { a: [1, 2] } });
    const result = cache.read({ type: "Type", select: cql`{ a }` });
    expect(result!.data).toEqual({ a: [1, 2] });
  });

  it("should be able to read a specific field within arrays", () => {
    const Type = schema.array({ name: "Type" });
    const cache = new Cache({ types: [Type] });
    cache.write({ type: "Type", data: [{ a: "a", b: "b" }] });
    const result = cache.read({ type: "Type", select: cql`{ a }` });
    expect(result!.data).toEqual([{ a: "a" }]);
  });

  it("should be able to alias a field with a selector", () => {
    const Type = schema.object({ name: "Type" });
    const cache = new Cache({ types: [Type] });
    cache.write({ type: "Type", data: { a: "a" } });
    const result = cache.read({
      type: "Type",
      select: cql`{ c: a }`,
    });
    expect(result!.data).toEqual({ c: "a" });
  });

  it("should be able to read with a fragment", () => {
    const Type = schema.object({ name: "Type" });
    const cache = new Cache({ types: [Type] });
    cache.write({ type: "Type", data: { id: "1" } });
    const result = cache.read({
      type: "Type",
      id: "1",
      select: cql`fragment TypeDetail on Type { id }`,
    });
    expect(result!.data).toEqual({ id: "1" });
  });

  it("should throw if the fragment type does not match", () => {
    const Type = schema.object({ name: "Type" });
    const cache = new Cache({ types: [Type] });
    cache.write({ type: "Type", data: { id: "1" } });
    expect(() => {
      cache.read({
        type: "Type",
        id: "1",
        select: cql`fragment TypeDetail on DifferentType { id }`,
      });
    }).toThrow();
  });

  it("should be able to read with an inline fragment", () => {
    const Type = schema.object({ name: "Type" });
    const cache = new Cache({ types: [Type] });
    cache.write({ type: "Type", data: { a: "a", b: "b" } });
    const result = cache.read({
      type: "Type",
      select: cql`{ ... on Type { b } }`,
    });
    expect(result!.data).toEqual({ b: "b" });
  });

  it("should be able to read with multiple inline fragments", () => {
    const Type = schema.object({ name: "Type" });
    const cache = new Cache({ types: [Type] });
    cache.write({ type: "Type", data: { a: "a", b: "b" } });
    const result = cache.read({
      type: "Type",
      select: cql`{ ... on Type { b } ... on Type { a } }`,
    });
    expect(result!.data).toEqual({ a: "a", b: "b" });
  });

  it("should return an empty object if none of the inline fragments match", () => {
    const Type = schema.object({ name: "Type" });
    const cache = new Cache({ types: [Type] });
    cache.write({ type: "Type", data: { a: "a", b: "b" } });
    const result = cache.read({
      type: "Type",
      select: cql`{ ... on DifferentType { b } }`,
    });
    expect(result!.data).toEqual({});
  });

  it("should be able to spread fragments", () => {
    const ChildFrag = cql`fragment ChildFrag on Child { b }`;
    const Child = schema.object({ name: "Child" });
    const Parent = schema.object({ name: "Parent", fields: { child: Child } });
    const cache = new Cache({ types: [Parent] });
    cache.write({ type: "Parent", data: { child: { a: "a", b: "b" } } });
    const result = cache.read({
      type: "Parent",
      select: cql`{ child { ...ChildFrag } } ${ChildFrag}`,
    });
    expect(result!.data).toEqual({ child: { b: "b" } });
  });

  it("should be able to read specific fields from unions", () => {
    const Type1 = schema.object({
      name: "Type1",
      isOfType: (value: any) => value.type === "1",
    });
    const Type2 = schema.object({
      name: "Type2",
      isOfType: (value: any) => value.type === "2",
    });
    const Search = schema.array({
      name: "Search",
      ofType: schema.union({ types: [Type1, Type2] }),
    });
    const cache = new Cache({ types: [Search] });
    cache.write({
      type: "Search",
      data: [
        { type: "1", a: "a", b: "b" },
        { type: "2", a: "a", b: "b" },
      ],
    });
    const result = cache.read({
      type: "Search",
      select: cql`{ ... on Type1 { a } ... on Type2 { b } }`,
    });
    expect(result!.data).toEqual([{ a: "a" }, { b: "b" }]);
  });

  it("should not be able to modify cache values", () => {
    const Child = schema.object({ name: "Child" });
    const Parent = schema.object({ name: "Parent", fields: { child: Child } });
    const cache = new Cache({ types: [Parent] });
    cache.write({
      type: "Parent",
      data: { a: "a", child: { id: "1", a: "a", b: { c: "c" } } },
    });
    const result = cache.read<any>({ type: "Parent" });
    result!.data.child.b.c = "d";
    const result2 = cache.read<any>({
      type: "Parent",
      select: cql`{ child { b { c } } }`,
    });
    expect(result2!.data).toEqual({
      child: { b: { c: "c" } },
    });
  });

  it("should be able to read specifc fields from nested entities", () => {
    const Child = schema.object({ name: "Child" });
    const Parent = schema.object({ name: "Parent", fields: { child: Child } });
    const cache = new Cache({ types: [Parent] });
    cache.write({ type: "Parent", data: { child: { id: "1", a: "a" } } });
    const result = cache.read({
      type: "Parent",
      select: cql`{ child { a } }`,
    });
    expect(result!.data).toEqual({ child: { a: "a" } });
  });

  it("should be able to read all fields from nested entities by only specifying the entity field", () => {
    const Child = schema.object({ name: "Child" });
    const Parent = schema.object({ name: "Parent", fields: { child: Child } });
    const cache = new Cache({ types: [Parent] });
    cache.write({
      type: "Parent",
      data: { child: { id: "1", a: "a", b: { c: "c" } } },
    });
    const result = cache.read({
      type: "Parent",
      select: cql`{ child }`,
    });
    expect(result!.data).toEqual({ child: { id: "1", a: "a", b: { c: "c" } } });
  });

  it("should be able to read all fields from nested entities with circular references by only specifying the entity field", () => {
    const Child = schema.object({
      name: "Child",
      fields: () => ({ parent: Parent }),
    });
    const Parent = schema.object({ name: "Parent", fields: { child: Child } });
    const cache = new Cache({ types: [Parent] });
    cache.write({
      type: "Parent",
      data: { id: "1", child: { id: "2", a: "a", parent: { id: "1" } } },
    });
    const result = cache.read<any>({
      type: "Parent",
      id: "1",
      select: cql`{ child }`,
    });
    expect(result!.data.id).toBe(undefined);
    expect(result!.data.child.id).toBe("2");
    expect(result!.data.child.a).toBe("a");
    expect(result!.data.child.parent.id).toBe("1");
    expect(result!.data.child.parent.child.id).toBe("2");
    expect(result!.data.child.parent.child.parent.child.a).toBe("a");
  });

  it("should be able to read all fields from nested entities with circular references by only specifying the entity", () => {
    const Child = schema.object({
      name: "Child",
      fields: () => ({ parent: Parent }),
    });
    const Parent = schema.object({ name: "Parent", fields: { child: Child } });
    const cache = new Cache({ types: [Parent] });
    cache.write({
      type: "Parent",
      data: { id: "1", child: { id: "2", a: "a", parent: { id: "1" } } },
    });
    const result = cache.read<any>({ type: "Parent", id: "1" });
    expect(result!.data.id).toBe("1");
    expect(result!.data.child.id).toBe("2");
    expect(result!.data.child.a).toBe("a");
    expect(result!.data.child.parent.id).toBe("1");
    expect(result!.data.child.parent.child.id).toBe("2");
    expect(result!.data.child.parent.child.parent.child.a).toBe("a");
  });

  it("should be able to read all fields with a star but have specific selection sets for some fields", () => {
    const Child = schema.object({ name: "Child" });
    const Parent = schema.object({ name: "Parent", fields: { child: Child } });
    const cache = new Cache({ types: [Parent] });
    cache.write({
      type: "Parent",
      data: { a: "a", child: { id: "1", a: "a", b: { c: "c" } } },
    });
    const result = cache.read({
      type: "Parent",
      select: cql`{ * child { b } }`,
    });
    expect(result!.data).toEqual({ a: "a", child: { b: { c: "c" } } });
  });

  it("should be able to define a computed field", () => {
    const Type = schema.object({
      name: "Type",
      fields: {
        computed: {
          read: (parent) => parent.a,
        },
      },
    });
    const cache = new Cache({ types: [Type] });
    cache.write({ type: "Type", data: { a: "a" } });
    const result = cache.read({ type: "Type", select: cql`{ a computed }` });
    expect(result!.data).toEqual({ a: "a", computed: "a" });
  });

  it("should be able to return references in computed fields", () => {
    const Author = schema.object({ name: "Author" });
    const Post = schema.object({
      name: "Post",
      fields: {
        author: {
          read: (post, ctx) => {
            return ctx.toReference({ type: "Author", id: post.authorId });
          },
        },
      },
    });
    const cache = new Cache({ types: [Post, Author] });
    cache.write({ type: "Post", data: { id: "1", authorId: "2" } });
    cache.write({ type: "Author", data: { id: "2", name: "Name" } });
    const result = cache.read({
      type: "Post",
      id: "1",
      select: cql`{ author { name } }`,
    });
    expect(result!.data).toEqual({ author: { name: "Name" } });
  });
});
