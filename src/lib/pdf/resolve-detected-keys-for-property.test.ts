import { describe, expect, it } from "vitest";
import { resolveDetectedKeysForProperty } from "./resolve-detected-keys-for-property";

describe("resolveDetectedKeysForProperty", () => {
  it("maps passport to id when only id is required", () => {
    expect(
      resolveDetectedKeysForProperty(["passport"], ["id", "proof_of_income"]),
    ).toEqual(["id"]);
  });

  it("keeps passport when property explicitly requires it", () => {
    expect(
      resolveDetectedKeysForProperty(["passport"], ["passport"]),
    ).toEqual(["passport"]);
  });
});
