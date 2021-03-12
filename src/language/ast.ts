export const NodeType = {
  Document: "Document",
  Field: "Field",
  FragmentDefinition: "FragmentDefinition",
  FragmentSpread: "FragmentSpread",
  InlineFragment: "InlineFragment",
  Name: "Name",
  NamedType: "NamedType",
  SelectionSet: "SelectionSet",
  Star: "Star",
} as const;

export interface DocumentNode {
  kind: "Document";
  definitions: DefinitionNode[];
  src?: string;
}

export type DefinitionNode = FragmentDefinitionNode | SelectionSetNode;

export interface FragmentDefinitionNode {
  kind: "FragmentDefinition";
  name: NameNode;
  typeCondition: NamedTypeNode;
  selectionSet: SelectionSetNode;
}

export interface FragmentSpreadNode {
  kind: "FragmentSpread";
  name: NameNode;
}

export interface SelectionSetNode {
  kind: "SelectionSet";
  selections: SelectionNode[];
}

export type SelectionNode =
  | FieldNode
  | FragmentSpreadNode
  | InlineFragmentNode
  | StarNode;

export interface StarNode {
  kind: "Star";
}

export interface FieldNode {
  kind: "Field";
  alias?: NameNode;
  name: NameNode;
  selectionSet?: SelectionSetNode;
}

export interface NameNode {
  kind: "Name";
  value: string;
}

export interface NamedTypeNode {
  kind: "NamedType";
  name: NameNode;
}

export interface InlineFragmentNode {
  kind: "InlineFragment";
  typeCondition?: NamedTypeNode;
  selectionSet: SelectionSetNode;
}
