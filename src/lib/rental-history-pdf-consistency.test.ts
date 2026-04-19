import { describe, expect, it } from "vitest";
import type { RentalHistory } from "@/lib/types";
import {
  rentalHistoryAfterPdfDocRemoval,
  shouldClearPdfDerivedRentalFields,
} from "./rental-history-pdf-consistency";

const rentalHistoryFixture = (): RentalHistory => ({
  yearsRenting: 0,
  onTimePaymentsPct: 0,
  referenceQuality: "strong",
  monthsRenting: 18,
  recommendationSentiment: "strong",
});

describe("shouldClearPdfDerivedRentalFields", () => {
  it("returns true when removing the last rental/reference doc", () => {
    expect(shouldClearPdfDerivedRentalFields("rental_history", ["id"])).toBe(true);
    expect(shouldClearPdfDerivedRentalFields("references", ["passport"])).toBe(true);
  });

  it("returns false when another rental/reference doc still remains", () => {
    expect(shouldClearPdfDerivedRentalFields("rental_history", ["references"])).toBe(false);
    expect(shouldClearPdfDerivedRentalFields("references", ["rental_history"])).toBe(false);
  });

  it("returns false for non-rental docs", () => {
    expect(shouldClearPdfDerivedRentalFields("proof_of_income", ["rental_history"])).toBe(false);
  });
});

describe("rentalHistoryAfterPdfDocRemoval", () => {
  it("clears derived fields only when the last rental/reference doc is removed", () => {
    expect(rentalHistoryAfterPdfDocRemoval(rentalHistoryFixture(), "references", ["rental_history"])).toEqual(
      rentalHistoryFixture(),
    );

    expect(rentalHistoryAfterPdfDocRemoval(rentalHistoryFixture(), "references", ["id"])).toEqual({
      yearsRenting: 0,
      onTimePaymentsPct: 0,
      referenceQuality: "none",
      monthsRenting: null,
      recommendationSentiment: null,
    });
  });
});
