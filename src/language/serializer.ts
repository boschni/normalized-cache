import type { DocumentNode } from "./ast";

export function serializeSelector(selector: DocumentNode): string;
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function serializeSelector(selector: any): string {
  if (!selector._id) {
    selector._id = JSON.stringify(selector);
  }
  return selector._id;
}
