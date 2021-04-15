export const ErrorCode = {
  TYPE_NOT_FOUND: 1,
  UNABLE_TO_INFER_ENTITY_ID: 2,
  TYPE_CHECK: 3,
  INVALID_SELECTOR: 4,
  INVALID_CONST: 5,
  SELECTOR_SCHEMA_MISMATCH: 6,
  WRITE_CIRCULAR_DATA: 7,
};

export function invariant(
  condition: unknown,
  msgOrCode: string | number
): asserts condition {
  if (!condition) {
    if (typeof msgOrCode === "number") {
      msgOrCode = "Minified Error #" + msgOrCode;
    }
    const error = new Error(msgOrCode);
    error.name = "Cache Error";
    throw error;
  }
}
