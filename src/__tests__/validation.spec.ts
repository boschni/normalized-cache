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

    it("should not write fields unknown to the schema if onlyWriteKnownFields is enabled", () => {
      const Type = schema.object({
        name: "Type",
        fields: { a: schema.string() },
      });
      const cache = new Cache({ types: [Type], onlyWriteKnownFields: true });
      cache.write({ type: "Type", data: { a: "a", b: "b" } });
      const readResult = cache.read({ type: "Type" });
      expect(readResult!.data).toEqual({ a: "a" });
    });

    it("should write fields unknown to the schema if an object does not have fields defined and onlyWriteKnownFields is enabled", () => {
      const Type = schema.object({ name: "Type" });
      const cache = new Cache({ types: [Type], onlyWriteKnownFields: true });
      cache.write({ type: "Type", data: { a: "a", b: "b" } });
      const readResult = cache.read({ type: "Type" });
      expect(readResult!.data).toEqual({ a: "a", b: "b" });
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
  });

  describe("reading", () => {
    const Child = schema.object({
      name: "Child",
      fields: {
        id: schema.string(),
        a: schema.string(),
        b: schema.nonNullable(schema.number()),
        c: schema.nonNullable(schema.number()),
        d: schema.number(),
        e: schema.array(schema.number()),
        f: {
          type: schema.string(),
          read: () => 1,
        },
        g: schema.object(),
      },
    });
    const Parent = schema.object({
      name: "Parent",
      fields: { child: Child },
    });
    const Primitive = schema.string({
      name: "Primitive",
    });

    it("should not report missing fields if the selected data is found", () => {
      const cache = new Cache({ types: [Parent] });
      cache.write({
        type: "Parent",
        data: { child: { id: "1", a: "a" } },
      });
      const result = cache.read({
        type: "Parent",
        select: cql`{ child { a } }`,
      });
      expect(result!.data).toEqual({ child: { a: "a" } });
      expect(result!.missingFields).toBeUndefined();
    });

    it("should not report missing fields if the selected data is in the cache but set to undefined", () => {
      const cache = new Cache({ types: [Parent] });
      cache.write({
        type: "Parent",
        data: { child: { id: "1", c: undefined } },
      });
      const result = cache.read({
        type: "Parent",
        select: cql`{ child { c } }`,
      });
      expect(result!.data).toEqual({ child: {} });
      expect(result!.missingFields).toBeUndefined();
    });

    it("should report missing fields if the selected data is missing", () => {
      const cache = new Cache({ types: [Parent] });
      cache.write({
        type: "Parent",
        data: { child: { id: "1" } },
      });
      const result = cache.read({
        type: "Parent",
        select: cql`{ child { b } }`,
      });
      expect(result!.data).toEqual({ child: {} });
      expect(result!.missingFields).toEqual([{ path: ["child", "b"] }]);
    });

    it("should report invalid fields if the entity is invalid", () => {
      const cache = new Cache({ types: [Primitive] });
      cache.write({ type: "Primitive", data: 1 });
      const result = cache.read({ type: "Primitive" });
      expect(result!.data).toEqual(1);
      expect(result!.invalidFields).toEqual([{ path: [], value: 1 }]);
    });

    it("should report invalid fields if the computed field is invalid", () => {
      const cache = new Cache({ types: [Parent] });
      cache.write({
        type: "Parent",
        data: { child: { id: "1" } },
      });
      const result = cache.read({
        type: "Parent",
        select: cql`{ child { f } }`,
      });
      expect(result!.data).toEqual({ child: { f: 1 } });
      expect(result!.invalidFields).toEqual([
        { path: ["child", "f"], value: 1 },
      ]);
    });

    it("should not report invalid fields if the selected data is found and valid", () => {
      const cache = new Cache({ types: [Parent] });
      cache.write({
        type: "Parent",
        data: { child: { id: "1", a: "a" } },
      });
      const result = cache.read({
        type: "Parent",
        select: cql`{ child { a } }`,
      });
      expect(result!.data).toEqual({ child: { a: "a" } });
      expect(result!.invalidFields).toBeUndefined();
    });

    it("should report invalid fields if the selected data is in the cache but invalid", () => {
      const cache = new Cache({ types: [Parent] });
      cache.write({
        type: "Parent",
        data: { child: { id: "1", c: undefined } },
      });
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
      const cache = new Cache({ types: [Parent] });
      cache.write({
        type: "Parent",
        data: { child: { id: "1", e: ["invalid"] } },
      });
      const result = cache.read({
        type: "Parent",
        select: cql`{ child { e } }`,
      });
      expect(result!.data).toEqual({ child: { e: ["invalid"] } });
      expect(result!.invalidFields).toEqual([
        { path: ["child", "e", 0], value: "invalid" },
      ]);
    });

    it("should read fields from objects without fields defined when onlyReadKnownFields is enabled", () => {
      const cache = new Cache({ types: [Parent], onlyReadKnownFields: true });
      cache.write({
        type: "Parent",
        data: { child: { id: "1", g: { a: "a" } } },
      });
      const readResult = cache.read({
        type: "Parent",
        select: cql`{ child { g { a } } }`,
      });
      expect(readResult!.data).toEqual({ child: { g: { a: "a" } } });
    });

    it("should not read fields unknown to the schema if onlyReadKnownFields is enabled", () => {
      const cache = new Cache({ types: [Parent], onlyReadKnownFields: true });
      cache.write({
        type: "Parent",
        data: { child: { id: "1", a: "a", z: "z" } },
      });
      const readResult = cache.read({
        type: "Parent",
        select: cql`{ child { a z } }`,
      });
      expect(readResult!.data).toEqual({ child: { a: "a" } });
    });
  });
});
