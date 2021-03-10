import { ErrorCode, invariant } from "../utils/invariant";
import {
  DocumentNode,
  FieldNode,
  FragmentDefinitionNode,
  FragmentSpreadNode,
  InlineFragmentNode,
  NameNode,
  NodeType,
  SelectionSetNode,
  StarNode,
} from "./ast";

type Parser = (state: ParserState) => ParserState;

interface ParserState {
  src: string;
  pos: number;
  result?: any;
  error?: boolean;
}

// GENERIC COMBINATORS

const recursive = (fn: () => Parser): Parser => (state) => fn()(state);

const optional = (parser: Parser): Parser => (state) => {
  if (state.error) {
    return state;
  }
  const next = parser(state);
  return next.error ? { ...state, result: undefined } : next;
};

const map = (parser: Parser, fn: (result: any) => any): Parser => (state) => {
  const next = parser(state);
  return next.error ? next : { ...next, result: fn(next.result) };
};

const sequence = (parsers: Parser[]): Parser => (state) => {
  if (state.error) {
    return state;
  }

  const results: any[] = [];
  let next = state;

  for (let i = 0; i < parsers.length; i++) {
    next = parsers[i](next);

    if (next.error) {
      return next;
    }

    results.push(next.result);
  }

  return { ...next, result: results };
};

const many = (parser: Parser): Parser => (state) => {
  if (state.error) {
    return state;
  }

  const results = [];
  let next = state;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const out = parser(next);
    if (out.error) {
      break;
    } else {
      next = out;
      results.push(next.result);
      if (next.pos >= next.src.length) {
        break;
      }
    }
  }

  return { ...next, result: results };
};

const choice = (parsers: Parser[]): Parser => (state) => {
  if (state.error) {
    return state;
  }

  for (let i = 0; i < parsers.length; i++) {
    const nextState = parsers[i](state);

    if (!nextState.error) {
      return nextState;
    }
  }

  return { ...state, error: true };
};

const regex = (re: RegExp): Parser => (state) => {
  if (state.error) {
    return state;
  }

  const match = re.exec(state.src.slice(state.pos));

  if (match === null) {
    return { ...state, error: true };
  }

  return { ...state, pos: state.pos + match[0].length, result: match[0] };
};

const str = (value: string): Parser => (state) => {
  if (state.error) {
    return state;
  }

  if (state.src.slice(state.pos).startsWith(value)) {
    return { ...state, pos: state.pos + value.length, result: value };
  }

  return { ...state, error: true };
};

const whitespace = regex(/^\s+/);

const optionalWhitespace = optional(whitespace);

// SPECIFIC COMBINATORS

const name = map(
  regex(/^[a-zA-Z0-9_]+/),
  (result): NameNode => ({ kind: NodeType.Name, value: result })
);

const quotedName = map(
  regex(/^"((?:\\.|.)*?)"/),
  (result): NameNode => ({
    kind: NodeType.Name,
    value: result.substr(1, result.length - 2),
  })
);

const fieldName = choice([name, quotedName]);

const star = map(str("*"), (): StarNode => ({ kind: NodeType.Star }));

const selectionSet = recursive(() =>
  map(
    sequence([str("{"), many(selection), optionalWhitespace, str("}")]),
    (result): SelectionSetNode => ({
      kind: NodeType.SelectionSet,
      selections: result[1],
    })
  )
);

const alias = map(sequence([fieldName, str(":")]), (result) => result[0]);

const field = map(
  sequence([
    optional(alias),
    optionalWhitespace,
    fieldName,
    optionalWhitespace,
    optional(selectionSet),
  ]),
  (result): FieldNode => ({
    kind: NodeType.Field,
    alias: result[0],
    name: result[2],
    selectionSet: result[4],
  })
);

const fragmentSpread = map(
  sequence([str("..."), name]),
  (result): FragmentSpreadNode => ({
    kind: NodeType.FragmentSpread,
    name: result[1],
  })
);

const inlineFragment = map(
  sequence([
    str("... on"),
    optionalWhitespace,
    name,
    optionalWhitespace,
    selectionSet,
  ]),
  (result): InlineFragmentNode => ({
    kind: NodeType.InlineFragment,
    typeCondition: {
      kind: NodeType.NamedType,
      name: result[2],
    },
    selectionSet: result[4],
  })
);

const fragment = map(
  sequence([
    str("fragment"),
    optionalWhitespace,
    name,
    optionalWhitespace,
    str("on"),
    optionalWhitespace,
    name,
    optionalWhitespace,
    selectionSet,
  ]),
  (result): FragmentDefinitionNode => ({
    kind: NodeType.FragmentDefinition,
    name: result[2],
    typeCondition: {
      kind: NodeType.NamedType,
      name: result[6],
    },
    selectionSet: result[8],
  })
);

const selection = map(
  sequence([
    optionalWhitespace,
    choice([star, field, inlineFragment, fragmentSpread]),
  ]),
  (result) => result[1]
);

const definition = map(
  sequence([optionalWhitespace, choice([selectionSet, fragment])]),
  (result) => result[1]
);

const document = map(
  many(definition),
  (result): DocumentNode => ({
    kind: NodeType.DocumentNode,
    definitions: result,
  })
);

export const parse = (src: string): DocumentNode => {
  const state = document({ pos: 0, src });

  invariant(
    !state.error,
    process.env.NODE_ENV === "production"
      ? ErrorCode.INVALID_SELECTOR
      : `Unable to parse the selector ${src}`
  );

  const documentNode = state.result;
  documentNode.src = src;
  return documentNode;
};
