import { useDeferredValue } from "react";

/** Keeps search inputs responsive while large in-memory result sets are filtered. */
export function useDeferredSearch(value: string): string {
  return useDeferredValue(value.trim().toLowerCase());
}
