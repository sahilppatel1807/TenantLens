import { describe, expect, it } from "vitest";
import {
  categorySatisfied,
  DEFAULT_PROPERTY_REQUIRED_DOCUMENTS,
  documentKeyCategory,
  missingRepresentativeRequiredKeys,
  propertyRequiresDocumentCategory,
  requiredCategoryIds,
  submittedCategoryIds,
  togglePropertyRequiredDocumentCategory,
} from "./document-categories";
import type { DocumentKey } from "./types";

describe("documentKeyCategory", () => {
  it("maps identity, income, bank, and rental keys", () => {
    expect(documentKeyCategory("id")).toBe("identity");
    expect(documentKeyCategory("passport")).toBe("identity");
    expect(documentKeyCategory("drivers_licence")).toBe("identity");
    expect(documentKeyCategory("proof_of_income")).toBe("income");
    expect(documentKeyCategory("employment_letter")).toBe("income");
    expect(documentKeyCategory("bank_statements")).toBe("bank");
    expect(documentKeyCategory("rental_history")).toBe("rental");
    expect(documentKeyCategory("references")).toBe("rental");
  });
});

describe("requiredCategoryIds", () => {
  it("dedupes categories in first-seen order", () => {
    const required: DocumentKey[] = ["id", "passport", "proof_of_income", "bank_statements"];
    expect(requiredCategoryIds(required)).toEqual(["identity", "income", "bank"]);
  });
});

describe("submittedCategoryIds", () => {
  it("dedupes submitted categories", () => {
    const submitted: DocumentKey[] = ["passport", "drivers_licence", "proof_of_income"];
    expect(submittedCategoryIds(submitted)).toEqual(["identity", "income"]);
  });
});

describe("categorySatisfied", () => {
  it("treats passport as satisfying an id requirement", () => {
    expect(categorySatisfied("id", ["passport"])).toBe(true);
  });
});

describe("missingRepresentativeRequiredKeys", () => {
  it("returns one key per unsatisfied category", () => {
    expect(
      missingRepresentativeRequiredKeys(["id", "proof_of_income", "bank_statements"], ["passport"]),
    ).toEqual(["proof_of_income", "bank_statements"]);
  });

  it("does not duplicate missing rows when multiple required keys share a category", () => {
    expect(missingRepresentativeRequiredKeys(["id", "passport"], [])).toEqual(["id"]);
  });
});

describe("DEFAULT_PROPERTY_REQUIRED_DOCUMENTS", () => {
  it("lists four canonical keys in category order", () => {
    expect(DEFAULT_PROPERTY_REQUIRED_DOCUMENTS).toEqual([
      "id",
      "proof_of_income",
      "bank_statements",
      "rental_history",
    ]);
  });
});

describe("propertyRequiresDocumentCategory", () => {
  it("treats legacy keys as their category", () => {
    expect(propertyRequiresDocumentCategory(["passport"], "identity")).toBe(true);
    expect(propertyRequiresDocumentCategory(["references"], "rental")).toBe(true);
    expect(propertyRequiresDocumentCategory(["employment_letter"], "income")).toBe(true);
  });
});

describe("togglePropertyRequiredDocumentCategory", () => {
  it("normalizes to canonical keys for enabled categories", () => {
    expect(togglePropertyRequiredDocumentCategory(["passport", "references"], "bank")).toEqual([
      "id",
      "bank_statements",
      "rental_history",
    ]);
  });

  it("removes a category when toggled off", () => {
    expect(togglePropertyRequiredDocumentCategory(["id", "proof_of_income"], "income")).toEqual(["id"]);
  });
});

/**
 * Regression: AddPropertyDialog seeds / resets `docs` with DEFAULT; EditPropertyDialog
 * seeds from `property.requiredDocuments` and uses the same toggle helper.
 */
describe("property required-documents dialog contract", () => {
  it("matches AddPropertyDialog default and reset payload shape", () => {
    const initial = [...DEFAULT_PROPERTY_REQUIRED_DOCUMENTS];
    const afterReset = [...DEFAULT_PROPERTY_REQUIRED_DOCUMENTS];
    expect(initial).toEqual(afterReset);
    expect(initial).toEqual([
      "id",
      "proof_of_income",
      "bank_statements",
      "rental_history",
    ]);
  });

  it("normalizes legacy persisted keys when a category is toggled", () => {
    const fromDb: DocumentKey[] = ["passport", "employment_letter"];
    const editFormDocs = [...fromDb];
    expect(togglePropertyRequiredDocumentCategory(editFormDocs, "identity")).toEqual([
      "proof_of_income",
    ]);
    expect(togglePropertyRequiredDocumentCategory(editFormDocs, "income")).toEqual(["id"]);
  });
});
