import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_PROPERTY_REQUIRED_DOCUMENTS } from "../document-categories";
import { scoreApplicant } from "../scoring";
import type { Applicant, Property } from "../types";
import { processApplicantPdfBuffer } from "./process-applicant-pdf-buffer";

const {
  extractPdfTextMock,
  analyzePayslipTextIncomeMock,
  parseReferenceLetterTextMock,
} = vi.hoisted(() => ({
  extractPdfTextMock: vi.fn(),
  analyzePayslipTextIncomeMock: vi.fn(),
  parseReferenceLetterTextMock: vi.fn(),
}));

vi.mock("./extract-pdf-text", () => ({
  extractPdfText: extractPdfTextMock,
}));

vi.mock("./parse-payslip-income", () => ({
  analyzePayslipTextIncome: analyzePayslipTextIncomeMock,
}));

vi.mock("./parse-reference-letter", () => ({
  parseReferenceLetterText: parseReferenceLetterTextMock,
}));

/**
 * Phase 4: representative folder intake — four conventionally named PDFs should map to
 * one key per default required category so completeness is fully satisfied.
 */
describe("folder intake (four canonical filenames)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    extractPdfTextMock
      .mockResolvedValueOnce("Gross pay $2,000 per week")
      .mockResolvedValueOnce("Excellent tenant, 24 months.");
    analyzePayslipTextIncomeMock.mockReturnValue({
      weeklyIncome: 2000,
      confidence: "high",
    });
    parseReferenceLetterTextMock.mockReturnValue({
      monthsRenting: 24,
      recommendationSentiment: "strong",
    });
  });

  it("yields submitted keys that satisfy default property required categories", async () => {
    const filenames = [
      "Alex_passport.pdf",
      "Alex_payslip.pdf",
      "Alex_bank_statement.pdf",
      "Alex_reference.pdf",
    ] as const;

    const keys = new Set<string>();
    for (const name of filenames) {
      const r = await processApplicantPdfBuffer(Buffer.from("pdf"), { filename: name });
      for (const k of r.mappedDocumentKeys) keys.add(k);
    }

    expect(Array.from(keys).sort()).toEqual(
      ["bank_statements", "id", "proof_of_income", "references"].sort(),
    );

    const property: Property = {
      id: "p1",
      address: "1 St",
      suburb: "X",
      city: "Y",
      weeklyRent: 500,
      bedrooms: 1,
      bathrooms: 1,
      parking: 0,
      imageUrl: "",
      status: "active",
      requiredDocuments: [...DEFAULT_PROPERTY_REQUIRED_DOCUMENTS],
      createdAt: "2026-01-01T00:00:00.000Z",
    };

    const applicant: Applicant = {
      id: "a1",
      propertyId: "p1",
      name: "Alex Case",
      email: "a@ex.com",
      phone: "0",
      occupation: "—",
      weeklyIncome: 2000,
      submittedDocuments: Array.from(keys) as Applicant["submittedDocuments"],
      rentalHistory: {
        yearsRenting: 2,
        onTimePaymentsPct: 100,
        referenceQuality: "strong",
        monthsRenting: 24,
        recommendationSentiment: "strong",
      },
      appliedAt: "2026-01-02T00:00:00.000Z",
      status: "new",
    };

    const scored = scoreApplicant(applicant, property);
    expect(scored.missingDocuments).toEqual([]);
    expect(scored.completeness).toBe(50);
  });
});
