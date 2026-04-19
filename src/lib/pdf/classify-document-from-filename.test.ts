import { describe, expect, it } from "vitest";
import { classifyDocumentFromFilename } from "./classify-document-from-filename";

describe("classifyDocumentFromFilename", () => {
  it("maps id-style filenames to photo_id", () => {
    expect(classifyDocumentFromFilename("sahil_passport.pdf")).toBe("photo_id");
  });

  it("maps payslip filenames to payslip", () => {
    expect(classifyDocumentFromFilename("sahil_payslip_1.pdf")).toBe("payslip");
  });

  it("maps income filenames to payslip", () => {
    expect(classifyDocumentFromFilename("sahil_income.pdf")).toBe("payslip");
  });

  it("returns unknown for unrelated filenames", () => {
    expect(classifyDocumentFromFilename("misc_notes.pdf")).toBe("unknown");
  });

  it("maps tenancy-style filenames to rental_history", () => {
    expect(classifyDocumentFromFilename("lease_terms.pdf")).toBe("rental_history");
  });

  it("prefers rental_history for landlord reference filenames", () => {
    expect(classifyDocumentFromFilename("landlord_reference_12-smith-street.pdf")).toBe(
      "rental_history",
    );
  });

  it("maps reference-style filenames to references", () => {
    expect(classifyDocumentFromFilename("character_reference_letter.pdf")).toBe("references");
  });

  it("maps bank statement filenames to bank_statement", () => {
    expect(classifyDocumentFromFilename("bank_statement_march.pdf")).toBe("bank_statement");
  });

  it("maps employment letter filenames to employment_letter", () => {
    expect(classifyDocumentFromFilename("employment_verification_letter.pdf")).toBe(
      "employment_letter",
    );
  });
});
