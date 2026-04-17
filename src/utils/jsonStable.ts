import stringify from "fast-json-stable-stringify";

/**
 * Serialize an object to a canonical (stable key-order) JSON string.
 * This is used for hashing to ensure determinism.
 *
 * NEVER call JSON.stringify() for anything that needs to be hashed.
 * Always use this function.
 */
export function canonicalJson(obj: unknown): string {
  const result = stringify(obj);
  if (result === undefined) {
    throw new Error("canonicalJson: cannot serialize undefined");
  }
  return result;
}
