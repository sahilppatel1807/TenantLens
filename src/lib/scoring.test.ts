import { describe, expect, it } from "vitest";
import {
  scoreApplicant,
  scoreRecommendationForHistory,
  scoreTenancyMonthsForHistory,
  tierFor,
} from "./scoring";
import { Applicant, Property } from "./types";

function baseProperty(overrides: Partial<Property> = {}): Property {
  return {
    id: "prop-1",
    address: "1 Test St",
    suburb: "CBD",
    city: "Melbourne",
    weeklyRent: 500,
    bedrooms: 2,
    bathrooms: 1,
    parking: 1,
    imageUrl: "https://images.unsplash.com/photo-1",
    status: "active",
    requiredDocuments: ["id", "proof_of_income"],
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function baseApplicant(overrides: Partial<Applicant> = {}): Applicant {
  return {
    id: "app-1",
    propertyId: "prop-1",
    name: "Alex Case",
    email: "alex@example.com",
    phone: "0400000000",
    occupation: "Engineer",
    weeklyIncome: 2000,
    submittedDocuments: ["id", "proof_of_income"],
    rentalHistory: {
      yearsRenting: 2,
      onTimePaymentsPct: 100,
      referenceQuality: "strong",
      monthsRenting: null,
      recommendationSentiment: null,
    },
    appliedAt: "2026-01-02T00:00:00.000Z",
    status: "new",
    ...overrides,
  };
}

describe("tierFor", () => {
  it("returns good for scores at or above 75", () => {
    expect(tierFor(75)).toBe("good");
    expect(tierFor(100)).toBe("good");
  });

  it("returns average for scores from 50 through 74", () => {
    expect(tierFor(50)).toBe("average");
    expect(tierFor(74)).toBe("average");
  });

  it("returns bad for scores below 50", () => {
    expect(tierFor(49)).toBe("bad");
    expect(tierFor(0)).toBe("bad");
  });
});

describe("scoreApplicant", () => {
  const property = baseProperty();
  const applicant = baseApplicant();

  it("marks missing required documents", () => {
    const a = baseApplicant({ submittedDocuments: ["id"] });
    const result = scoreApplicant(a, property);
    expect(result.missingDocuments).toEqual(["proof_of_income"]);
    expect(result.completeness).toBe(25);
  });

  it("gives full completeness when no documents are required", () => {
    const p = baseProperty({ requiredDocuments: [] });
    const a = baseApplicant({ submittedDocuments: [] });
    const result = scoreApplicant(a, p);
    expect(result.completeness).toBe(50);
    expect(result.missingDocuments).toEqual([]);
  });

  it("maps income vs rent bands", () => {
    const p = baseProperty({ weeklyRent: 100 });
    expect(scoreApplicant(baseApplicant({ weeklyIncome: 300 }), p).income).toBe(30);
    expect(scoreApplicant(baseApplicant({ weeklyIncome: 260 }), p).income).toBe(25);
    expect(scoreApplicant(baseApplicant({ weeklyIncome: 200 }), p).income).toBe(18);
    expect(scoreApplicant(baseApplicant({ weeklyIncome: 150 }), p).income).toBe(10);
    expect(scoreApplicant(baseApplicant({ weeklyIncome: 149 }), p).income).toBe(9);
    expect(scoreApplicant(baseApplicant({ weeklyIncome: 140 }), p).income).toBe(8);
    expect(scoreApplicant(baseApplicant({ weeklyIncome: 130 }), p).income).toBe(7);
    expect(scoreApplicant(baseApplicant({ weeklyIncome: 125 }), p).income).toBe(5);
    expect(scoreApplicant(baseApplicant({ weeklyIncome: 100 }), p).income).toBe(4);
  });

  it("maps lower income boundaries precisely", () => {
    const p = baseProperty({ weeklyRent: 100 });
    expect(scoreApplicant(baseApplicant({ weeklyIncome: 149 }), p).income).toBe(9);
    expect(scoreApplicant(baseApplicant({ weeklyIncome: 148 }), p).income).toBe(8);
    expect(scoreApplicant(baseApplicant({ weeklyIncome: 140 }), p).income).toBe(8);
    expect(scoreApplicant(baseApplicant({ weeklyIncome: 139 }), p).income).toBe(7);
    expect(scoreApplicant(baseApplicant({ weeklyIncome: 130 }), p).income).toBe(7);
    expect(scoreApplicant(baseApplicant({ weeklyIncome: 129 }), p).income).toBe(5);
    expect(scoreApplicant(baseApplicant({ weeklyIncome: 125 }), p).income).toBe(5);
    expect(scoreApplicant(baseApplicant({ weeklyIncome: 124 }), p).income).toBe(4);
  });

  it("uses rent-to-income ratio 0 when weekly rent is zero", () => {
    const p = baseProperty({ weeklyRent: 0 });
    const result = scoreApplicant(baseApplicant({ weeklyIncome: 1000 }), p);
    expect(result.rentToIncomeRatio).toBe(0);
    expect(result.income).toBe(0);
  });

  it("sets income score based on ratio even when proof of income is missing", () => {
    const p = baseProperty({ weeklyRent: 850 });
    const result = scoreApplicant(
      baseApplicant({
        weeklyIncome: 1206,
        submittedDocuments: ["id", "bank_statements"],
      }),
      p,
    );
    expect(result.rentToIncomeRatio).toBeCloseTo(1206/850, 2);
    expect(result.income).toBe(8);
  });

  it("scores rental history as binary 0 or 20", () => {
    const longTenureStrong = baseApplicant({
      rentalHistory: {
        yearsRenting: 10,
        onTimePaymentsPct: 100,
        referenceQuality: "strong",
        monthsRenting: null,
        recommendationSentiment: null,
      },
    });
    expect(scoreApplicant(longTenureStrong, property).history).toBe(20);

    const shortOk = baseApplicant({
      rentalHistory: {
        yearsRenting: 0,
        onTimePaymentsPct: 0,
        referenceQuality: "ok",
        monthsRenting: null,
        recommendationSentiment: null,
      },
    });
    expect(scoreApplicant(shortOk, property).history).toBe(20);

    const shortNone = baseApplicant({
      rentalHistory: {
        yearsRenting: 0,
        onTimePaymentsPct: 0,
        referenceQuality: "none",
        monthsRenting: null,
        recommendationSentiment: null,
      },
    });
    expect(scoreApplicant(shortNone, property).history).toBe(0);
  });

  it("sets rental history score to 0 when no reference evidence exists", () => {
    const a = baseApplicant({
      submittedDocuments: ["id", "proof_of_income"],
      rentalHistory: {
        yearsRenting: 5,
        onTimePaymentsPct: 100,
        referenceQuality: "none",
        monthsRenting: null,
        recommendationSentiment: null,
      },
    });
    expect(scoreApplicant(a, property).history).toBe(0);
  });

  it("applies tenancy month rubric for history sub-score", () => {
    expect(scoreTenancyMonthsForHistory(0)).toBe(3);
    expect(scoreTenancyMonthsForHistory(4)).toBe(3);
    expect(scoreTenancyMonthsForHistory(5)).toBe(4);
    expect(scoreTenancyMonthsForHistory(10)).toBe(9);
    expect(scoreTenancyMonthsForHistory(12)).toBe(9);
    expect(scoreTenancyMonthsForHistory(13)).toBe(10);
  });

  it("prefers extracted months over years when scoring", () => {
    const a = baseApplicant({
      rentalHistory: {
        yearsRenting: 10,
        onTimePaymentsPct: 100,
        referenceQuality: "strong",
        monthsRenting: 6,
        recommendationSentiment: "neutral",
      },
    });
    expect(scoreApplicant(a, property).history).toBe(20);
  });

  it("grades recommendation sentiment for history sub-score", () => {
    const base = {
      yearsRenting: 0,
      onTimePaymentsPct: 0,
      referenceQuality: "none" as const,
      monthsRenting: null,
    };
    expect(
      scoreRecommendationForHistory({
        ...base,
        recommendationSentiment: "strong",
      }),
    ).toBe(20);
    expect(
      scoreRecommendationForHistory({
        ...base,
        recommendationSentiment: "neutral",
      }),
    ).toBe(20);
    expect(
      scoreRecommendationForHistory({
        ...base,
        recommendationSentiment: "negative",
      }),
    ).toBe(0);
  });

  it("returns total as sum of parts and a consistent tier", () => {
    const result = scoreApplicant(applicant, property);
    expect(result.total).toBe(result.completeness + result.income + result.history);
    expect(result.tier).toBe(tierFor(result.total));
  });

  it("treats passport as satisfying the identity category when only id is required", () => {
    const p = baseProperty({ requiredDocuments: ["id", "proof_of_income"] });
    const a = baseApplicant({ submittedDocuments: ["passport", "proof_of_income"] });
    const result = scoreApplicant(a, p);
    expect(result.completeness).toBe(50);
    expect(result.missingDocuments).toEqual([]);
  });

  it("counts duplicate required keys in the same category once for completeness", () => {
    const p = baseProperty({ requiredDocuments: ["id", "passport", "proof_of_income"] });
    const a = baseApplicant({ submittedDocuments: ["proof_of_income"] });
    const result = scoreApplicant(a, p);
    expect(result.completeness).toBe(Math.round((1 / 2) * 50));
    expect(result.missingDocuments).toEqual(["id"]);
  });

  it("treats references as satisfying rental_history in the same category", () => {
    const p = baseProperty({ requiredDocuments: ["id", "rental_history"] });
    const a = baseApplicant({ submittedDocuments: ["id", "references"] });
    const result = scoreApplicant(a, p);
    expect(result.completeness).toBe(50);
    expect(result.missingDocuments).toEqual([]);
  });
});
