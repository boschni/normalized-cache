import { Cache, cql, schema } from "..";

describe("Validation", () => {
  describe("writing", () => {
    it("should not report invalid fields if the incoming data matches the schema", () => {
      const Type = schema.string({ name: "Type" });
      const cache = new Cache({ types: [Type] });
      const { invalidFields } = cache.write({ type: "Type", data: "a" });
      expect(invalidFields).toBeUndefined();
    });

    it("should report invalid fields if the incoming data does not match the schema", () => {
      const Type = schema.string({ name: "Type" });
      const cache = new Cache({ types: [Type] });
      const { invalidFields } = cache.write({ type: "Type", data: 1 });
      expect(invalidFields).toEqual([{ path: [], value: 1 }]);
    });

    it("should report invalid fields if the incoming required data is missing", () => {
      const Type = schema.nonNullable({
        name: "Type",
        ofType: schema.string(),
      });
      const cache = new Cache({ types: [Type] });
      const { invalidFields } = cache.write({ type: "Type", data: undefined });
      expect(invalidFields).toEqual([{ path: [], value: undefined }]);
    });

    it("should not write data in strict mode if the incoming data does not match the schema", () => {
      const Type = schema.string({ name: "Type" });
      const cache = new Cache({ types: [Type] });
      cache.write({ type: "Type", data: 1, strict: true });
      const readResult = cache.read({ type: "Type" });
      expect(readResult).toBeUndefined();
    });

    it("should not write data in strict mode if the incoming data is missing required data", () => {
      const Type = schema.object({
        name: "Type",
        fields: { a: schema.nonNullable(schema.string()) },
      });
      const cache = new Cache({ types: [Type] });
      cache.write({ type: "Type", data: {}, strict: true });
      const readResult = cache.read({ type: "Type" });
      expect(readResult).toBeUndefined();
    });

    it("should not report invalid fields if the incoming data has additional fields", () => {
      const Type = schema.object({
        name: "Type",
        fields: { id: schema.number() },
      });
      const cache = new Cache({ types: [Type] });
      const { invalidFields } = cache.write({
        type: "Type",
        data: { id: 1, a: "a" },
      });
      expect(invalidFields).toBeUndefined();
    });

    it("should not report invalid fields if the incoming data has a valid boolean", () => {
      const Type = schema.object({
        name: "Type",
        fields: { a: schema.boolean() },
      });
      const cache = new Cache({ types: [Type] });
      const { invalidFields } = cache.write({
        type: "Type",
        data: { a: true },
      });
      expect(invalidFields).toBeUndefined();
    });

    it("should report invalid fields if the incoming data has an invalid boolean", () => {
      const Type = schema.object({
        name: "Type",
        fields: { a: schema.boolean() },
      });
      const cache = new Cache({ types: [Type] });
      const { invalidFields } = cache.write({ type: "Type", data: { a: 0 } });
      expect(invalidFields).toEqual([{ path: ["a"], value: 0 }]);
    });

    it("should not report invalid fields if the incoming data has a valid const string", () => {
      const Type = schema.object({
        name: "Type",
        fields: { a: schema.string({ const: "A" }) },
      });
      const cache = new Cache({ types: [Type] });
      const { invalidFields } = cache.write({ type: "Type", data: { a: "A" } });
      expect(invalidFields).toBeUndefined();
    });

    it("should report invalid fields if the incoming data has an invalid const string", () => {
      const Type = schema.object({
        name: "Type",
        fields: { a: schema.string({ const: "A" }) },
      });
      const cache = new Cache({ types: [Type] });
      const { invalidFields } = cache.write({ type: "Type", data: { a: "B" } });
      expect(invalidFields).toEqual([{ path: ["a"], value: "B" }]);
    });

    it("should not report invalid fields if the incoming data has a valid union", () => {
      const Type = schema.object({
        name: "Type",
        fields: {
          a: schema.union({
            types: [
              schema.string({ const: "A" }),
              schema.string({ const: "B" }),
            ],
          }),
        },
      });
      const cache = new Cache({ types: [Type] });
      const { invalidFields } = cache.write({ type: "Type", data: { a: "B" } });
      expect(invalidFields).toBeUndefined();
    });

    it("should report invalid fields if the incoming data has an invalid union", () => {
      const Type = schema.object({
        name: "Type",
        fields: {
          a: schema.union([schema.string("A"), schema.string("B")]),
        },
      });
      const cache = new Cache({ types: [Type] });
      const { invalidFields } = cache.write({ type: "Type", data: { a: "C" } });
      expect(invalidFields).toEqual([{ path: ["a"], value: "C" }]);
    });

    it("should not report invalid fields if the incoming nested data matches the schema", () => {
      const Child = schema.object({
        name: "Child",
        fields: {
          a: schema.number(),
        },
      });
      const Parent = schema.object({
        name: "Parent",
        fields: { child: Child },
      });
      const cache = new Cache({ types: [Parent] });
      const { invalidFields } = cache.write({
        type: "Parent",
        data: { child: { id: "1", a: 1 } },
      });
      expect(invalidFields).toBeUndefined();
    });

    it("should report invalid fields if the incoming nested data does not match the schema", () => {
      const Child = schema.object({
        name: "Child",
        fields: {
          a: schema.number(),
        },
      });
      const Parent = schema.object({
        name: "Parent",
        fields: { child: Child },
      });
      const cache = new Cache({ types: [Parent] });
      const { invalidFields } = cache.write({
        type: "Parent",
        data: { child: { id: "1", a: "a" } },
      });
      expect(invalidFields).toEqual([{ path: ["child", "a"], value: "a" }]);
    });

    it("should not report invalid fields if the incoming data is missing optional data", () => {
      const Child = schema.object({
        name: "Child",
        fields: {
          a: schema.number(),
        },
      });
      const Parent = schema.object({
        name: "Parent",
        fields: { child: Child },
      });
      const cache = new Cache({ types: [Parent] });
      const { invalidFields } = cache.write({
        type: "Parent",
        data: { child: { id: "1" } },
      });
      expect(invalidFields).toBeUndefined();
    });

    it("should report invalid fields if the incoming data is missing required data", () => {
      const Child = schema.object({
        name: "Child",
        fields: {
          a: schema.nonNullable(schema.number()),
        },
      });
      const Parent = schema.object({
        name: "Parent",
        fields: { child: Child },
      });
      const cache = new Cache({ types: [Parent] });
      const { invalidFields } = cache.write({
        type: "Parent",
        data: { child: { id: "1" } },
      });
      expect(invalidFields).toEqual([
        { path: ["child", "a"], value: undefined },
      ]);
    });
  });

  describe("reading", () => {
    const Child = schema.object({
      name: "Child",
      fields: {
        a: schema.string(),
        b: schema.nonNullable(schema.number()),
        c: schema.nonNullable(schema.number()),
        d: schema.number(),
        e: schema.array(schema.number()),
      },
    });
    const Parent = schema.object({
      name: "Parent",
      fields: { child: Child },
    });
    const Primitive = schema.string({
      name: "Primitive",
    });
    const cache = new Cache({ types: [Parent, Primitive] });
    cache.write({ type: "Primitive", data: 1 });
    cache.write({
      type: "Parent",
      data: { child: { id: "1", a: "a", c: undefined, e: ["invalid"] } },
    });

    it("should not report missing fields if the selected data is found", () => {
      const result = cache.read({
        type: "Parent",
        select: cql`{ child { a } }`,
      });
      expect(result!.data).toEqual({ child: { a: "a" } });
      expect(result!.missingFields).toBeUndefined();
    });

    it("should not report missing fields if the selected data is in the cache but set to undefined", () => {
      const result = cache.read({
        type: "Parent",
        select: cql`{ child { c } }`,
      });
      expect(result!.data).toEqual({ child: {} });
      expect(result!.missingFields).toBeUndefined();
    });

    it("should report missing fields if the selected data is missing", () => {
      const result = cache.read({
        type: "Parent",
        select: cql`{ child { b } }`,
      });
      expect(result!.data).toEqual({ child: {} });
      expect(result!.missingFields).toEqual([{ path: ["child", "b"] }]);
    });

    it("should report invalid fields if the entity is invalid", () => {
      const result = cache.read({ type: "Primitive" });
      expect(result!.data).toEqual(1);
      expect(result!.invalidFields).toEqual([{ path: [], value: 1 }]);
    });

    it("should not report invalid fields if the selected data is found and valid", () => {
      const result = cache.read({
        type: "Parent",
        select: cql`{ child { a } }`,
      });
      expect(result!.data).toEqual({ child: { a: "a" } });
      expect(result!.invalidFields).toBeUndefined();
    });

    it("should report invalid fields if the selected data is in the cache but invalid", () => {
      const result = cache.read({
        type: "Parent",
        select: cql`{ child { c } }`,
      });
      expect(result!.data).toEqual({ child: { c: undefined } });
      expect(result!.invalidFields).toEqual([
        { path: ["child", "c"], value: undefined },
      ]);
    });

    it("should report invalid fields if an array contains invalid data", () => {
      const result = cache.read({
        type: "Parent",
        select: cql`{ child { e } }`,
      });
      expect(result!.data).toEqual({ child: { e: ["invalid"] } });
      expect(result!.invalidFields).toEqual([
        { path: ["child", "e", 0], value: "invalid" },
      ]);
    });
  });
});
