import { DocumentNode } from "./ast";
import { parse } from "./parser";

describe("language.parse", () => {
  it("should be able to parse no fields", () => {
    const src = "{}";
    const ast = parse(src);

    const result: DocumentNode = {
      kind: "Document",
      src,
      definitions: [
        {
          kind: "SelectionSet",
          selections: [],
        },
      ],
    };

    expect(ast).toEqual(result);
  });

  it("should be able to parse quoted field", () => {
    const src = '{ "fiel d" field }';
    const ast = parse(src);

    const result: DocumentNode = {
      kind: "Document",
      src,
      definitions: [
        {
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
        },
      ],
    };

    expect(ast).toEqual(result);
  });

  it("should be able to parse one field", () => {
    const src = "{ field }";
    const ast = parse(src);

    const result: DocumentNode = {
      kind: "Document",
      src,
      definitions: [
        {
          kind: "SelectionSet",
          selections: [
            {
              kind: "Field",
              name: { kind: "Name", value: "field" },
            },
          ],
        },
      ],
    };

    expect(ast).toEqual(result);
  });

  it("should be able to parse stars", () => {
    const src = "{ * }";
    const ast = parse(src);

    const result: DocumentNode = {
      kind: "Document",
      src,
      definitions: [
        {
          kind: "SelectionSet",
          selections: [
            {
              kind: "Star",
            },
          ],
        },
      ],
    };

    expect(ast).toEqual(result);
  });

  it("should be able to parse multiple fields", () => {
    const src = "{ field1 field2 }";
    const ast = parse(src);

    const result: DocumentNode = {
      kind: "Document",
      src,
      definitions: [
        {
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
        },
      ],
    };

    expect(ast).toEqual(result);
  });

  it("should be able to parse nested fields", () => {
    const src = " {field1 { nested1a nested1b }field2 {nested2a nested2b }}";
    const ast = parse(src);

    const result: DocumentNode = {
      kind: "Document",
      src,
      definitions: [
        {
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
        },
      ],
    };

    expect(ast).toEqual(result);
  });

  it("should be able to parse field aliases", () => {
    const src = "{ alias1: field1 alias2: field2 field3 }";
    const ast = parse(src);

    const result: DocumentNode = {
      kind: "Document",
      src,
      definitions: [
        {
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
        },
      ],
    };

    expect(ast).toEqual(result);
  });

  it("should be able to parse inline fragments", () => {
    const src = `
      {
        ... on Post {
          title
        }
        ... on Comment {
          text
        }
      }
    `;

    const ast = parse(src);

    const result: DocumentNode = {
      kind: "Document",
      src,
      definitions: [
        {
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
        },
      ],
    };

    expect(ast).toEqual(result);
  });
});
