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

  it("maps ApplicantName_reference with matching applicantName to references", () => {
    expect(classifyDocumentFromFilename("Sahil_reference.pdf", "Sahil Khan")).toBe("references");
  });

  it("maps ApplicantName_bank_statement with matching applicantName to bank_statement", () => {
    expect(classifyDocumentFromFilename("sahil_bank_statement_jan.pdf", "Sahil")).toBe(
      "bank_statement",
    );
  });

  it("does not strip a mismatched name prefix when applicantName is provided", () => {
    expect(classifyDocumentFromFilename("jane_misc_application.pdf", "Sahil")).toBe("unknown");
  });

  it("does not strip leading token without applicantName when remainder would stay unknown", () => {
    expect(classifyDocumentFromFilename("foo_bar.pdf")).toBe("unknown");
  });

  it("matches compact full name in the first underscore segment", () => {
    expect(classifyDocumentFromFilename("SahilKhan_passport.pdf", "Sahil Khan")).toBe("photo_id");
  });

  it("classifies dl in remainder after name strip as photo_id", () => {
    expect(classifyDocumentFromFilename("Sahil_dl.pdf", "Sahil")).toBe("photo_id");
  });

  it("accepts mixed space/underscore after applicant prefix", () => {
    expect(classifyDocumentFromFilename("jason bank_statement.pdf", "Jason")).toBe("bank_statement");
  });

  it("accepts space-separated tokens for applicant + document type", () => {
    expect(classifyDocumentFromFilename("jason bank statement jan.pdf", "Jason")).toBe("bank_statement");
  });

  it("accepts common bank-statement misspelling satement", () => {
    expect(classifyDocumentFromFilename("jason_bank satement.pdf", "Jason")).toBe("bank_statement");
  });

  it("matches applicant prefix case-insensitively", () => {
    expect(classifyDocumentFromFilename("JASON_Payslip.pdf", "jason")).toBe("payslip");
  });
});
