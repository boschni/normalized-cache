import {
  DocumentNode,
  FieldNode,
  InlineFragmentNode,
  NodeType,
  SelectionSetNode,
} from "./ast";

export function createDocument(): DocumentNode {
  return {
    kind: NodeType.Document,
    definitions: [],
  };
}

export function createField(fieldName: string): FieldNode {
  return {
    kind: NodeType.Field,
    name: {
      kind: NodeType.Name,
      value: fieldName,
    },
  };
}

export function createSelectionSet(): SelectionSetNode {
  return { kind: NodeType.SelectionSet, selections: [] };
}

export function createInlineFragment(typeName: string): InlineFragmentNode {
  return {
    kind: NodeType.InlineFragment,
    selectionSet: createSelectionSet(),
    typeCondition: {
      kind: NodeType.NamedType,
      name: {
        kind: NodeType.Name,
        value: typeName,
      },
    },
  };
}
