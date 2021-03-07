import type { SelectorNode } from "./ast";
import { parse } from "./parser";

const CACHE: Record<string, SelectorNode> = {};

export function cql(input: TemplateStringsArray): SelectorNode {
  const src = input.join("").trim();

  if (!CACHE[src]) {
    CACHE[src] = parse(src);
  }

  return CACHE[src];
}
