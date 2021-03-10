import { DocumentNode, NodeType } from "./ast";
import { parse } from "./parser";

const CACHE: Record<string, DocumentNode> = {};

export function cql(
  strings: TemplateStringsArray,
  ...values: Array<string | DocumentNode>
): DocumentNode {
  let result = ``;

  strings.forEach((str, index) => {
    let value = index <= values.length - 1 ? values[index] : ``;

    if (
      typeof value !== "string" &&
      value.kind === NodeType.DocumentNode &&
      value.src
    ) {
      value = value.src;
    }

    result += str + value;
  });

  const src = result.trim();

  if (!CACHE[src]) {
    CACHE[src] = parse(src);
  }

  return CACHE[src];
}
