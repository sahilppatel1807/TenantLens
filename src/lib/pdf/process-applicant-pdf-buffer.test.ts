import { beforeEach, describe, expect, it, vi } from "vitest";

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

describe("processApplicantPdfBuffer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("parses payslip + reference targets successfully", async () => {
    extractPdfTextMock.mockResolvedValueOnce("income text").mockResolvedValueOnce("reference text");
    analyzePayslipTextIncomeMock.mockReturnValue({
      weeklyIncome: 1650,
      confidence: "high",
    });
    parseReferenceLetterTextMock.mockReturnValue({
      monthsRenting: 18,
      recommendationSentiment: "strong",
    });

    const payslipResult = await processApplicantPdfBuffer(Buffer.from("pdf"), {
      filename: "sam_income_april.pdf",
    });
    const referenceResult = await processApplicantPdfBuffer(Buffer.from("pdf"), {
      filename: "sam_reference_letter.pdf",
    });

    expect(payslipResult.extractionStatus).toBe("success");
    expect(payslipResult.displayType).toBe("payslip");
    expect(payslipResult.weeklyIncome).toBe(1650);
    expect(payslipResult.needsReview).toBe(false);

    expect(referenceResult.extractionStatus).toBe("success");
    expect(referenceResult.displayType).toBe("references");
    expect(referenceResult.monthsRenting).toBe(18);
    expect(referenceResult.recommendationSentiment).toBe("strong");
    expect(referenceResult.needsReview).toBe(false);
  });

  it("returns failed + needsReview when payslip text extraction fails", async () => {
    extractPdfTextMock.mockRejectedValueOnce(new Error("Unreadable PDF"));

    const result = await processApplicantPdfBuffer(Buffer.from("pdf"), {
      filename: "alex_payslip.pdf",
    });

    expect(result.displayType).toBe("payslip");
    expect(result.extractionStatus).toBe("failed");
    expect(result.weeklyIncome).toBeNull();
    expect(result.needsReview).toBe(true);
    expect(result.errorMessage).toContain("Unreadable PDF");
  });

  it("returns failed + needsReview when reference text extraction fails", async () => {
    extractPdfTextMock.mockRejectedValueOnce(new Error("Reference OCR failure"));

    const result = await processApplicantPdfBuffer(Buffer.from("pdf"), {
      filename: "character_reference_letter.pdf",
    });

    expect(result.displayType).toBe("references");
    expect(result.extractionStatus).toBe("failed");
    expect(result.monthsRenting).toBeNull();
    expect(result.recommendationSentiment).toBeNull();
    expect(result.needsReview).toBe(true);
    expect(result.errorMessage).toContain("Reference OCR failure");
  });

  it("skips extraction for non-target docs and keeps completion-only fields", async () => {
    const result = await processApplicantPdfBuffer(Buffer.from("pdf"), {
      filename: "passport_front.pdf",
    });

    expect(result.displayType).toBe("photo_id");
    expect(result.extractionStatus).toBe("success");
    expect(result.mappedDocumentKeys).toEqual(["id"]);
    expect(result.weeklyIncome).toBeNull();
    expect(result.monthsRenting).toBeNull();
    expect(result.recommendationSentiment).toBeNull();
    expect(result.needsReview).toBe(false);

    expect(extractPdfTextMock).not.toHaveBeenCalled();
    expect(analyzePayslipTextIncomeMock).not.toHaveBeenCalled();
    expect(parseReferenceLetterTextMock).not.toHaveBeenCalled();
  });

  it("prefers rental intent mapping from documentKey and parses reference details", async () => {
    extractPdfTextMock.mockResolvedValueOnce(
      "To whom it may concern, this confirms employment and salary. Also, tenant paid rent on time.",
    );
    parseReferenceLetterTextMock.mockReturnValue({
      monthsRenting: 24,
      recommendationSentiment: "strong",
    });

    const result = await processApplicantPdfBuffer(Buffer.from("pdf"), {
      filename: "to-whom-it-may-concern.pdf",
      documentKey: "rental_history",
    });

    expect(result.displayType).toBe("rental_history");
    expect(result.mappedDocumentKeys).toEqual(["rental_history"]);
    expect(result.monthsRenting).toBe(24);
    expect(result.recommendationSentiment).toBe("strong");
    expect(parseReferenceLetterTextMock).toHaveBeenCalledTimes(1);
    expect(analyzePayslipTextIncomeMock).not.toHaveBeenCalled();
  });

  it("uses references slot intent when provided and parses reference details", async () => {
    extractPdfTextMock.mockResolvedValueOnce("Reference text");
    parseReferenceLetterTextMock.mockReturnValue({
      monthsRenting: 12,
      recommendationSentiment: "neutral",
    });

    const result = await processApplicantPdfBuffer(Buffer.from("pdf"), {
      filename: "generic_letter.pdf",
      slot: "references",
    });

    expect(result.displayType).toBe("references");
    expect(result.mappedDocumentKeys).toEqual(["references"]);
    expect(result.monthsRenting).toBe(12);
    expect(result.recommendationSentiment).toBe("neutral");
    expect(parseReferenceLetterTextMock).toHaveBeenCalledTimes(1);
  });
});
