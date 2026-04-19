import { describe, expect, it } from "vitest";
import type { Applicant } from "@/lib/types";
import type { ApplicantPdfAnalyzeResultItem } from "@/lib/pdf/applicant-pdf-analyze-result";
import {
  mergeReferenceLetterFieldsFromAnalyzeResults,
  mergeRentalHistoryWithReferenceAnalyze,
  recommendationSentimentToReferenceQuality,
} from "./rental-history-from-pdf";

const emptyRentalHistory = (): Applicant["rentalHistory"] => ({
  yearsRenting: 0,
  onTimePaymentsPct: 100,
  referenceQuality: "none",
  monthsRenting: null,
  recommendationSentiment: null,
});

function sliceFromAnalyze(
  overrides: Partial<ApplicantPdfAnalyzeResultItem>,
): ApplicantPdfAnalyzeResultItem {
  return {
    filename: "test.pdf",
    displayType: "rental_history",
    extractionStatus: "success",
    mappedDocumentKeys: ["rental_history"],
    weeklyIncome: null,
    incomeConfidence: null,
    monthsRenting: 18,
    recommendationSentiment: "strong",
    needsReview: false,
    ...overrides,
  };
}

describe("recommendationSentimentToReferenceQuality", () => {
  it("maps sentiment to stored reference quality", () => {
    expect(recommendationSentimentToReferenceQuality("strong")).toBe("strong");
    expect(recommendationSentimentToReferenceQuality("neutral")).toBe("ok");
    expect(recommendationSentimentToReferenceQuality("negative")).toBe("weak");
  });
});

describe("mergeRentalHistoryWithReferenceAnalyze", () => {
  it("merges months and sentiment when displayType is rental_history (forced rental slot / pipeline)", () => {
    const current = emptyRentalHistory();
    const analyzed = sliceFromAnalyze({
      displayType: "rental_history",
      monthsRenting: 24,
      recommendationSentiment: "neutral",
    });
    const next = mergeRentalHistoryWithReferenceAnalyze(current, analyzed);
    expect(next.monthsRenting).toBe(24);
    expect(next.recommendationSentiment).toBe("neutral");
    expect(next.referenceQuality).toBe("ok");
  });

  it("merges when displayType is references", () => {
    const current = emptyRentalHistory();
    const analyzed = sliceFromAnalyze({
      displayType: "references",
      monthsRenting: 12,
      recommendationSentiment: "strong",
    });
    const next = mergeRentalHistoryWithReferenceAnalyze(current, analyzed);
    expect(next.monthsRenting).toBe(12);
    expect(next.recommendationSentiment).toBe("strong");
    expect(next.referenceQuality).toBe("strong");
  });

  it("does not merge employment_letter even if extraction succeeded", () => {
    const current = emptyRentalHistory();
    const analyzed = sliceFromAnalyze({
      displayType: "employment_letter",
      monthsRenting: 99,
      recommendationSentiment: "strong",
    });
    expect(mergeRentalHistoryWithReferenceAnalyze(current, analyzed)).toEqual(current);
  });

  it("does not merge on failed extraction", () => {
    const current = { ...emptyRentalHistory(), monthsRenting: 6 as number | null };
    const analyzed = sliceFromAnalyze({
      extractionStatus: "failed",
      monthsRenting: null,
      recommendationSentiment: null,
    });
    expect(mergeRentalHistoryWithReferenceAnalyze(current, analyzed)).toEqual(current);
  });

  it("takes max months when current already has tenure from PDF", () => {
    const current = { ...emptyRentalHistory(), monthsRenting: 10 };
    const analyzed = sliceFromAnalyze({ monthsRenting: 40 });
    const next = mergeRentalHistoryWithReferenceAnalyze(current, analyzed);
    expect(next.monthsRenting).toBe(40);
  });

  it("returns current when analyzed is null", () => {
    const current = emptyRentalHistory();
    expect(mergeRentalHistoryWithReferenceAnalyze(current, null)).toBe(current);
  });
});

describe("mergeReferenceLetterFieldsFromAnalyzeResults", () => {
  it("aggregates multiple reference/rental slices", () => {
    const results = [
      sliceFromAnalyze({
        displayType: "rental_history",
        monthsRenting: 12,
        recommendationSentiment: "neutral",
      }),
      sliceFromAnalyze({
        filename: "b.pdf",
        displayType: "references",
        monthsRenting: 24,
        recommendationSentiment: "strong",
      }),
    ];
    const merged = mergeReferenceLetterFieldsFromAnalyzeResults(results);
    expect(merged.monthsRenting).toBe(24);
    expect(merged.recommendationSentiment).toBe("strong");
  });

  it("ignores failed extractions and non-reference display types", () => {
    const results = [
      sliceFromAnalyze({
        extractionStatus: "failed",
        monthsRenting: 99,
        recommendationSentiment: "strong",
      }),
      sliceFromAnalyze({
        displayType: "payslip",
        monthsRenting: 99,
        recommendationSentiment: "strong",
      }),
      sliceFromAnalyze({
        filename: "ok.pdf",
        displayType: "rental_history",
        monthsRenting: 6,
        recommendationSentiment: "negative",
      }),
    ];
    const merged = mergeReferenceLetterFieldsFromAnalyzeResults(results);
    expect(merged.monthsRenting).toBe(6);
    expect(merged.recommendationSentiment).toBe("negative");
  });
});

describe("scoring vs storage consistency (rental PDF fields)", () => {
  it("merge output matches fields intake uses for rental PDF-derived columns", () => {
    const current = emptyRentalHistory();
    const analyzed = sliceFromAnalyze({
      displayType: "rental_history",
      monthsRenting: 14,
      recommendationSentiment: "neutral",
    });
    const merged = mergeRentalHistoryWithReferenceAnalyze(current, analyzed);
    const forScoring = {
      ...merged,
      yearsRenting: 2,
      onTimePaymentsPct: 95,
      referenceQuality: merged.referenceQuality,
      notes: undefined as string | undefined,
    };
    expect(forScoring.monthsRenting).toBe(merged.monthsRenting);
    expect(forScoring.recommendationSentiment).toBe(merged.recommendationSentiment);
    expect(forScoring.referenceQuality).toBe(recommendationSentimentToReferenceQuality("neutral"));
  });
});
