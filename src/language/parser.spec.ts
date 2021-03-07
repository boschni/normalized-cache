import { SelectionSetNode } from "./ast";
import { parse } from "./parser";

describe("language.parse", () => {
  it("should be able to parse no fields", () => {
    const ast = parse("{}");

    const result: SelectionSetNode = {
      kind: "SelectionSet",
      selections: [],
    };

    expect(ast).toEqual(result);
  });

  it("should be able to parse quoted field", () => {
    const ast = parse('{ "fiel d" field }');

    const result: SelectionSetNode = {
      kind: "SelectionSet",
      selections: [
        {
          kind: "Field",
          name: { kind: "Name", value: "fiel d" },
        },
        {
          kind: "Field",
          name: { kind: "Name", value: "field" },
        },
      ],
    };

    expect(ast).toEqual(result);
  });

  it("should be able to parse one field", () => {
    const ast = parse("{ field }");

    const result: SelectionSetNode = {
      kind: "SelectionSet",
      selections: [
        {
          kind: "Field",
          name: { kind: "Name", value: "field" },
        },
      ],
    };

    expect(ast).toEqual(result);
  });

  it("should be able to parse stars", () => {
    const ast = parse("{ * }");

    const result: SelectionSetNode = {
      kind: "SelectionSet",
      selections: [
        {
          kind: "Star",
        },
      ],
    };

    expect(ast).toEqual(result);
  });

  it("should be able to parse multiple fields", () => {
    const ast = parse("{ field1 field2 }");

    const result: SelectionSetNode = {
      kind: "SelectionSet",
      selections: [
        {
          kind: "Field",
          name: { kind: "Name", value: "field1" },
        },
        {
          kind: "Field",
          name: { kind: "Name", value: "field2" },
        },
      ],
    };

    expect(ast).toEqual(result);
  });

  it("should be able to parse nested fields", () => {
    const ast = parse(
      " {field1 { nested1a nested1b }field2 {nested2a nested2b }}"
    );

    const result: SelectionSetNode = {
      kind: "SelectionSet",
      selections: [
        {
          kind: "Field",
          name: { kind: "Name", value: "field1" },
          selectionSet: {
            kind: "SelectionSet",
            selections: [
              { kind: "Field", name: { kind: "Name", value: "nested1a" } },
              { kind: "Field", name: { kind: "Name", value: "nested1b" } },
            ],
          },
        },
        {
          kind: "Field",
          name: { kind: "Name", value: "field2" },
          selectionSet: {
            kind: "SelectionSet",
            selections: [
              { kind: "Field", name: { kind: "Name", value: "nested2a" } },
              { kind: "Field", name: { kind: "Name", value: "nested2b" } },
            ],
          },
        },
      ],
    };

    expect(ast).toEqual(result);
  });

  it("should be able to parse field aliases", () => {
    const ast = parse("{ alias1: field1 alias2: field2 field3 }");

    const result: SelectionSetNode = {
      kind: "SelectionSet",
      selections: [
        {
          kind: "Field",
          alias: { kind: "Name", value: "alias1" },
          name: { kind: "Name", value: "field1" },
        },
        {
          kind: "Field",
          alias: { kind: "Name", value: "alias2" },
          name: { kind: "Name", value: "field2" },
        },
        {
          kind: "Field",
          name: { kind: "Name", value: "field3" },
        },
      ],
    };

    expect(ast).toEqual(result);
  });

  it("should be able to parse inline fragments", () => {
    const ast = parse(`
      {
        ... on Post {
          title
        }
        ... on Comment {
          text
        }
      }
    `);

    const result: SelectionSetNode = {
      kind: "SelectionSet",
      selections: [
        {
          kind: "InlineFragment",
          typeCondition: {
            kind: "NamedType",
            name: { kind: "Name", value: "Post" },
          },
          selectionSet: {
            kind: "SelectionSet",
            selections: [
              { kind: "Field", name: { kind: "Name", value: "title" } },
            ],
          },
        },
        {
          kind: "InlineFragment",
          typeCondition: {
            kind: "NamedType",
            name: { kind: "Name", value: "Comment" },
          },
          selectionSet: {
            kind: "SelectionSet",
            selections: [
              { kind: "Field", name: { kind: "Name", value: "text" } },
            ],
          },
        },
      ],
    };

    expect(ast).toEqual(result);
  });
});
