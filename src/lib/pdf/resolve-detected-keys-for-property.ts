import type { DocumentKey } from "@/lib/types";

export function resolveDetectedKeysForProperty(
  detected: DocumentKey[],
  required: DocumentKey[],
): DocumentKey[] {
  const req = new Set(required);
  const out: DocumentKey[] = [];
  const seen = new Set<DocumentKey>();

  for (const k of detected) {
    let resolved = k;
    if (
      (k === "passport" || k === "drivers_licence") &&
      !req.has(k) &&
      req.has("id")
    ) {
      resolved = "id";
    }
    if (!seen.has(resolved)) {
      seen.add(resolved);
      out.push(resolved);
    }
  }
  return out;
}
