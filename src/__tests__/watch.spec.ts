import { Cache, ReadResult, cql, schema } from "..";

describe("Watch", () => {
  it("should be able to watch data", () => {
    const Type = schema.object({ name: "Type" });
    const cache = new Cache({ types: [Type] });
    const callback = jest.fn();
    cache.watch({ type: "Type", callback });
    cache.write({ type: "Type", data: { a: "a" } });

    const newResult: ReadResult = {
      entityID: "Type",
      data: { a: "a" },
      invalidated: false,
      expiresAt: -1,
      stale: false,
    };

    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining(newResult),
      undefined
    );
  });

  it("should be able to unsubscribe", () => {
    const Type = schema.object({ name: "Type" });
    const cache = new Cache({ types: [Type] });
    const callback = jest.fn();
    const { unsubscribe } = cache.watch({ type: "Type", callback });
    cache.write({ type: "Type", data: { a: "a" } });
    unsubscribe();
    cache.write({ type: "Type", data: { a: "b" } });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("should notify when the selected data changed", () => {
    const Type = schema.object({ name: "Type" });
    const cache = new Cache({ types: [Type] });
    const callback = jest.fn();
    cache.write({ type: "Type", data: { a: "a", b: "b" } });
    cache.watch({ type: "Type", select: cql`{ b }`, callback });
    cache.write({ type: "Type", data: { b: "bb" } });

    const prevResult: ReadResult = {
      data: { b: "b" },
      entityID: "Type",
      invalidated: false,
      expiresAt: -1,
      selector: expect.anything(),
      stale: false,
    };

    const newResult: ReadResult = {
      data: { b: "bb" },
      entityID: "Type",
      invalidated: false,
      expiresAt: -1,
      selector: expect.anything(),
      stale: false,
    };

    expect(callback).toHaveBeenCalledWith(newResult, prevResult);
  });

  it("should not notify when the written data did not change", () => {
    const Type = schema.object({ name: "Type" });
    const cache = new Cache({ types: [Type] });
    const callback = jest.fn();
    cache.write({ type: "Type", data: { a: "a" } });
    cache.watch({ type: "Type", callback });
    cache.write({ type: "Type", data: { a: "a" } });
    expect(callback).not.toHaveBeenCalled();
  });

  it("should not notify when the selected data did not change", () => {
    const Type = schema.object({ name: "Type" });
    const cache = new Cache({ types: [Type] });
    const callback = jest.fn();
    cache.write({ type: "Type", data: { a: "a", b: "b" } });
    cache.watch({ type: "Type", select: cql`{ b }`, callback });
    cache.write({ type: "Type", data: { a: "aa" } });
    expect(callback).not.toHaveBeenCalled();
  });

  it("should not notify when a write is done in silent mode", () => {
    const Type = schema.object({ name: "Type" });
    const cache = new Cache({ types: [Type] });
    const callback = jest.fn();
    cache.write({ type: "Type", data: { a: "a", b: "b" } });
    cache.watch({ type: "Type", select: cql`{ b }`, callback });
    cache.silent(() => {
      cache.write({ type: "Type", data: { b: "bb" } });
    });
    expect(callback).not.toHaveBeenCalled();
  });

  it("should notify once if multiple writes are done within a transaction", () => {
    const Type = schema.object({ name: "Type" });
    const cache = new Cache({ types: [Type] });
    const callback = jest.fn();
    cache.write({ type: "Type", data: { a: "a", b: "b" } });
    cache.watch({ type: "Type", select: cql`{ b }`, callback });
    cache.transaction(() => {
      cache.write({ type: "Type", data: { b: "bb" } });
      cache.write({ type: "Type", data: { b: "cc" } });
    });
    const prevResult: Partial<ReadResult> = {
      data: { b: "b" },
    };
    const newResult: Partial<ReadResult> = {
      data: { b: "cc" },
    };
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining(newResult),
      expect.objectContaining(prevResult)
    );
  });
});
