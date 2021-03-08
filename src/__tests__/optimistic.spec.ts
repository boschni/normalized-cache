import { Cache, cql, ReadResult, schema } from "..";

describe("Optimistic", () => {
  it("should read optimistic data by default", () => {
    const Child = schema.object({ name: "Child" });
    const Parent = schema.object({ name: "Parent", fields: { child: Child } });
    const cache = new Cache({ types: [Parent] });
    cache.write({ type: "Parent", data: { child: { id: "1", a: "a" } } });
    cache.write({
      type: "Parent",
      data: { child: { id: "1", b: "b" } },
      optimistic: true,
    });
    const { data } = cache.read({
      type: "Parent",
      select: cql`{ child { b } }`,
    });
    expect(data).toEqual({ child: { b: "b" } });
  });

  it("should not return optimistically deleted entities", () => {
    const Child = schema.object({ name: "Child" });
    const Parent = schema.object({ name: "Parent", fields: { child: Child } });
    const cache = new Cache({ types: [Parent] });
    cache.write({ type: "Parent", data: { child: { id: "1", a: "a" } } });
    cache.delete({ type: "Parent", optimistic: true });
    const { data: parentResult } = cache.read({
      type: "Parent",
      select: cql`{ child { a } }`,
    });
    const { data: childResult } = cache.read({
      type: "Child",
      id: "1",
      select: cql`{ a }`,
    });
    expect(parentResult).toEqual(undefined);
    expect(childResult).toEqual({ a: "a" });
  });

  it("should return optimistically deleted entities on non-optimistic reads", () => {
    const Child = schema.object({ name: "Child" });
    const Parent = schema.object({ name: "Parent", fields: { child: Child } });
    const cache = new Cache({ types: [Parent] });
    cache.write({ type: "Parent", data: { child: { id: "1", a: "a" } } });
    cache.delete({ type: "Parent", optimistic: true });
    const { data: parentResult } = cache.read({
      type: "Parent",
      select: cql`{ child { a } }`,
      optimistic: false,
    });
    expect(parentResult).toEqual({ child: { a: "a" } });
  });

  it("should not return optimistically deleted fields", () => {
    const Child = schema.object({ name: "Child" });
    const Parent = schema.object({ name: "Parent", fields: { child: Child } });
    const cache = new Cache({ types: [Parent] });
    cache.write({ type: "Parent", data: { child: { id: "1", a: "a" } } });
    cache.delete({
      type: "Parent",
      optimistic: true,
      select: cql`{ child { a } }`,
    });
    const { data: parentResult } = cache.read({
      type: "Parent",
      select: cql`{ child { a } }`,
    });
    const { data: childResult } = cache.read({
      type: "Child",
      id: "1",
      select: cql`{ id a }`,
    });
    expect(parentResult).toEqual({ child: {} });
    expect(childResult).toEqual({ id: "1" });
  });

  it("should return optimistically deleted fields on non-optimistic reads", () => {
    const Child = schema.object({ name: "Child" });
    const Parent = schema.object({ name: "Parent", fields: { child: Child } });
    const cache = new Cache({ types: [Parent] });
    cache.write({ type: "Parent", data: { child: { id: "1", a: "a" } } });
    cache.delete({
      type: "Parent",
      optimistic: true,
      select: cql`{ child { a } }`,
    });
    const { data: parentResult } = cache.read({
      type: "Parent",
      optimistic: false,
      select: cql`{ child { a } }`,
    });
    const { data: childResult } = cache.read({
      type: "Child",
      id: "1",
      optimistic: false,
      select: cql`{ id a }`,
    });
    expect(parentResult).toEqual({ child: { a: "a" } });
    expect(childResult).toEqual({ id: "1", a: "a" });
  });

  it("should be able to read non-optimistic data", () => {
    const Child = schema.object({ name: "Child" });
    const Parent = schema.object({ name: "Parent", fields: { child: Child } });
    const cache = new Cache({ types: [Parent] });
    cache.write({ type: "Parent", data: { child: { id: "1", a: "a" } } });
    cache.write({
      type: "Parent",
      data: { child: { id: "1", a: "aa" } },
      optimistic: true,
    });
    const { data } = cache.read({
      type: "Parent",
      select: cql`{ child { a } }`,
      optimistic: false,
    });
    expect(data).toEqual({ child: { a: "a" } });
  });

  it("should be able to apply an optimistic update function", () => {
    const Child = schema.object({ name: "Child" });
    const Parent = schema.object({ name: "Parent", fields: { child: Child } });
    const cache = new Cache({ types: [Parent] });
    cache.write({ type: "Parent", data: { child: { id: "1", a: "a" } } });
    cache.addOptimisticUpdate(() => {
      cache.write({ type: "Parent", data: { child: { id: "1", b: "b" } } });
    });
    const { data } = cache.read({
      type: "Parent",
      select: cql`{ child { b } }`,
    });
    expect(data).toEqual({ child: { b: "b" } });
  });

  it("should be able to apply multiple optimistic update functions", () => {
    const Child = schema.object({ name: "Child" });
    const Parent = schema.object({ name: "Parent", fields: { child: Child } });
    const cache = new Cache({ types: [Parent] });
    cache.write({ type: "Parent", data: { child: { id: "1", a: "a" } } });
    cache.addOptimisticUpdate(() => {
      cache.write({ type: "Parent", data: { child: { id: "1", b: "b" } } });
    });
    cache.addOptimisticUpdate(() => {
      cache.write({ type: "Parent", data: { child: { id: "1", c: "c" } } });
    });
    const { data } = cache.read({
      type: "Parent",
      select: cql`{ child { a b c } }`,
    });
    expect(data).toEqual({ child: { a: "a", b: "b", c: "c" } });
  });

  it("should be able to remove an optimistic update", () => {
    const Child = schema.object({ name: "Child" });
    const Parent = schema.object({ name: "Parent", fields: { child: Child } });
    const cache = new Cache({ types: [Parent] });
    cache.write({ type: "Parent", data: { child: { id: "1", a: "a" } } });
    const id = cache.addOptimisticUpdate(() => {
      cache.write({ type: "Parent", data: { child: { id: "1", b: "b" } } });
    });
    cache.removeOptimisticUpdate(id);
    const { data } = cache.read({
      type: "Parent",
      select: cql`{ child { b } }`,
    });
    expect(data).toEqual({ child: {} });
  });

  it("should re-apply optimistic update functions on non-optimistic write", () => {
    const Child = schema.object({ name: "Child" });
    const Parent = schema.object({ name: "Parent", fields: { child: Child } });
    const cache = new Cache({ types: [Parent] });
    cache.write({ type: "Parent", data: { child: { id: "1", a: "a" } } });
    cache.addOptimisticUpdate(() => {
      cache.write({ type: "Parent", data: { child: { id: "1", b: "b" } } });
    });
    cache.write({ type: "Parent", data: { child: { id: "1", c: "c" } } });
    const { data } = cache.read({
      type: "Parent",
      select: cql`{ child { b c } }`,
    });
    expect(data).toEqual({ child: { b: "b", c: "c" } });
  });

  it("should be able to write and delete in optimistic update functions", () => {
    const Child = schema.object({ name: "Child" });
    const Parent = schema.object({ name: "Parent", fields: { child: Child } });
    const cache = new Cache({ types: [Parent] });
    cache.write({ type: "Parent", data: { child: { id: "1", a: "a" } } });
    cache.addOptimisticUpdate(() => {
      cache.write({ type: "Parent", data: { child: { id: "1", b: "b" } } });
      cache.delete({ type: "Child", id: "1" });
    });
    const { data } = cache.read({
      type: "Parent",
      select: cql`{ child { b } }`,
    });
    expect(data).toEqual({ child: undefined });
  });

  it("should be able to read other optimistic updates in the update functions", () => {
    const Child = schema.object({ name: "Child" });
    const Parent = schema.object({ name: "Parent", fields: { child: Child } });
    const cache = new Cache({ types: [Parent] });
    cache.write({ type: "Parent", data: { child: { id: "1", a: "a" } } });
    cache.addOptimisticUpdate(() => {
      cache.delete({ type: "Child", id: "1" });
    });
    cache.addOptimisticUpdate(() => {
      const { data } = cache.read({ type: "Child", id: "1" });
      if (data) {
        cache.write({ type: "Parent", data: { child: { id: "1", c: "c" } } });
      }
    });
    const { data } = cache.read({
      type: "Parent",
      select: cql`{ child { a b c } }`,
    });
    expect(data).toEqual({ child: undefined });
  });

  it("should be able to remove one update function", () => {
    const Child = schema.object({ name: "Child" });
    const Parent = schema.object({ name: "Parent", fields: { child: Child } });
    const cache = new Cache({ types: [Parent] });
    cache.write({ type: "Parent", data: { child: { id: "1", a: "a" } } });
    const id1 = cache.addOptimisticUpdate(() => {
      cache.delete({ type: "Child", id: "1" });
    });
    const id2 = cache.addOptimisticUpdate(() => {
      const { data } = cache.read({ type: "Child", id: "1" });
      if (data) {
        cache.write({ type: "Parent", data: { child: { id: "1", c: "c" } } });
      }
    });
    cache.removeOptimisticUpdate(id1);
    const { data: result1 } = cache.read({
      type: "Parent",
      select: cql`{ child { a b c } }`,
    });
    expect(result1).toEqual({ child: { a: "a", c: "c" } });
    cache.removeOptimisticUpdate(id2);
    const { data: result2 } = cache.read({
      type: "Parent",
      select: cql`{ child { a b c } }`,
    });
    expect(result2).toEqual({ child: { a: "a" } });
  });

  it("should notify once when doing multiple writes in an update function", () => {
    const Child = schema.object({ name: "Child" });
    const Parent = schema.object({ name: "Parent", fields: { child: Child } });
    const cache = new Cache({ types: [Parent] });
    const callback = jest.fn();
    cache.write({ type: "Parent", data: { child: { id: "1", a: "a" } } });
    cache.watch({ type: "Parent", select: cql`{ child { a b c } }`, callback });
    cache.addOptimisticUpdate(() => {
      cache.write({ type: "Parent", data: { child: { id: "1", b: "b" } } });
      cache.write({ type: "Parent", data: { child: { id: "1", c: "c" } } });
    });
    const prevResult: Partial<ReadResult> = {
      data: { child: { a: "a" } },
    };
    const newResult: Partial<ReadResult> = {
      data: { child: { a: "a", b: "b", c: "c" } },
    };
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining(newResult),
      expect.objectContaining(prevResult)
    );
  });

  it("should notify once when applying multiple update functions", () => {
    const Child = schema.object({ name: "Child" });
    const Parent = schema.object({ name: "Parent", fields: { child: Child } });
    const cache = new Cache({ types: [Parent] });
    const callback = jest.fn();
    cache.write({ type: "Parent", data: { child: { id: "1", a: "a" } } });
    cache.addOptimisticUpdate(() => {
      cache.write({ type: "Parent", data: { child: { id: "1", b: "b" } } });
    });
    cache.addOptimisticUpdate(() => {
      cache.write({ type: "Parent", data: { child: { id: "1", c: "c" } } });
    });
    cache.watch({
      type: "Parent",
      select: cql`{ child { a b c d } }`,
      callback,
    });
    cache.write({ type: "Parent", data: { child: { id: "1", d: "d" } } });
    const prevResult: Partial<ReadResult> = {
      data: { child: { a: "a", b: "b", c: "c" } },
    };
    const newResult: Partial<ReadResult> = {
      data: { child: { a: "a", b: "b", c: "c", d: "d" } },
    };
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining(newResult),
      expect.objectContaining(prevResult)
    );
  });
});
