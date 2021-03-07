export const NodeType = {
  Field: "Field",
  FragmentDefinition: "FragmentDefinition",
  InlineFragment: "InlineFragment",
  Name: "Name",
  NamedType: "NamedType",
  SelectionSet: "SelectionSet",
  Star: "Star",
} as const;

export interface FragmentDefinitionNode {
  kind: "FragmentDefinition";
  name: NameNode;
  typeCondition: NamedTypeNode;
  selectionSet: SelectionSetNode;
}

export interface SelectionSetNode {
  kind: "SelectionSet";
  selections: SelectionNode[];
}

export type SelectionNode = FieldNode | InlineFragmentNode | StarNode;

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

export type SelectorNode = FragmentDefinitionNode | SelectionSetNode;
