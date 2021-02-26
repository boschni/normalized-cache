export const NodeType = {
  Argument: "Argument",
  Directive: "Directive",
  Field: "Field",
  FragmentDefinition: "FragmentDefinition",
  InlineFragment: "InlineFragment",
  Name: "Name",
  NamedType: "NamedType",
  SelectionSet: "SelectionSet",
  Star: "Star",
  Value: "Value",
  Variable: "Variable",
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
  arguments?: ArgumentNode[];
  directives?: DirectiveNode[];
  selectionSet?: SelectionSetNode;
}

export interface ArgumentNode {
  kind: "Argument";
  name: NameNode;
  value: ValueNode | VariableNode;
}

export interface NameNode {
  kind: "Name";
  value: string;
}

export interface NamedTypeNode {
  kind: "NamedType";
  name: NameNode;
}

export interface ValueNode {
  kind: "Value";
  value: unknown;
}

export interface VariableNode {
  kind: "Variable";
  name: NameNode;
}

export interface InlineFragmentNode {
  kind: "InlineFragment";
  typeCondition?: NamedTypeNode;
  selectionSet: SelectionSetNode;
}

export interface DirectiveNode {
  kind: "Directive";
  name: NameNode;
}

export type SelectorNode = FragmentDefinitionNode | SelectionSetNode;
