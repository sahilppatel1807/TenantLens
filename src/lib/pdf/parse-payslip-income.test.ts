import { describe, expect, it } from "vitest";
import {
  inferPayFrequencyFromDocument,
  inferPayPeriodDays,
  normalizeIncomeToWeekly,
  parseMoneyAUD,
  parseMoneyAUDExplicitDollar,
  parsePayslipIncomeFromText,
} from "./parse-payslip-income";

describe("normalizeIncomeToWeekly", () => {
  it("returns the same amount for weekly pay", () => {
    expect(normalizeIncomeToWeekly(1200, "weekly")).toBe(1200);
  });

  it("halves fortnightly pay", () => {
    expect(normalizeIncomeToWeekly(2400, "fortnightly")).toBe(1200);
  });

  it("converts monthly to an average weekly figure", () => {
    const weekly = normalizeIncomeToWeekly(4333, "monthly");
    expect(weekly).toBeCloseTo((4333 * 12) / 52, 10);
  });

  it("converts annual salary to weekly", () => {
    expect(normalizeIncomeToWeekly(52000, "annual")).toBeCloseTo(1000, 10);
  });

  it("returns null for unknown frequency", () => {
    expect(normalizeIncomeToWeekly(5000, "unknown")).toBeNull();
  });

  it("returns null for non-finite or negative amounts", () => {
    expect(normalizeIncomeToWeekly(Number.NaN, "weekly")).toBeNull();
    expect(normalizeIncomeToWeekly(-1, "weekly")).toBeNull();
  });
});

describe("parseMoneyAUD", () => {
  it("parses dollar amounts with optional currency symbol and commas", () => {
    expect(parseMoneyAUD("Gross Pay $1,234.50")).toEqual([1234.5]);
    expect(parseMoneyAUD("Totals: $2,000.50 then $100")).toEqual([2000.5, 100]);
  });

  it("parseMoneyAUDExplicitDollar ignores slash-dates and keeps $-prefixed amounts", () => {
    const line = "Pay Period From: 20/11/2025 To: 26/11/2025 GROSS PAY: $995.70";
    expect(parseMoneyAUDExplicitDollar(line)).toEqual([995.7]);
    expect(parseMoneyAUD(line).length).toBeGreaterThan(3);
  });

  it("parses explicit £ amounts", () => {
    expect(parseMoneyAUDExplicitDollar("Gross Earnings £2,500.50")).toEqual([2500.5]);
    expect(parseMoneyAUD("Net Payment €1,200.00")).toEqual([1200]);
  });
});

describe("inferPayPeriodDays", () => {
  it("returns inclusive day count for a pay period line", () => {
    const text = `Pay period from 01/01/2024 to 07/01/2024\nGross Pay $1000`;
    expect(inferPayPeriodDays(text)).toBe(7);
  });

  it("handles Pay Period From: … To: … with colons", () => {
    const text = `Pay Period From: 20/11/2025 To: 26/11/2025 GROSS PAY: $995.70`;
    expect(inferPayPeriodDays(text)).toBe(7);
  });

  it("handles DD.MM.YYYY dates around Pay Period (AU-style export)", () => {
    const text = `09.03.2026\tPay Period \t15.03.2026\t-\nWeekly\tPay Frequency`;
    expect(inferPayPeriodDays(text)).toBe(7);
  });
});

describe("inferPayFrequencyFromDocument", () => {
  it("reads pay frequency from labelled payroll lines", () => {
    expect(inferPayFrequencyFromDocument("Pay Frequency: Fortnightly\n")).toBe("fortnightly");
    expect(inferPayFrequencyFromDocument("Payment Frequency - Monthly")).toBe("monthly");
    expect(inferPayFrequencyFromDocument("Pay period type: Weekly")).toBe("weekly");
  });
});

describe("parsePayslipIncomeFromText", () => {
  it("prefers gross for a weekly pay period when dates are present", () => {
    const raw = `Pay period from 01/01/2024 to 07/01/2024
Gross Pay $1,500.00
Net Pay $1,100.00`;
    const r = parsePayslipIncomeFromText(raw);
    expect(r.detectedIncomeAmount).toBe(1500);
    expect(r.detectedPayFrequency).toBe("weekly");
    expect(r.amountSource).toBe("gross");
    expect(r.notes.some((n) => n.includes("GROSS PAY"))).toBe(true);
  });

  it("uses this-pay gross when a second column is YTD (two $ amounts)", () => {
    const raw = `Pay period from 01/01/2024 to 07/01/2024
Total Gross $1,205.59 $31,669.81`;
    const r = parsePayslipIncomeFromText(raw);
    expect(r.detectedIncomeAmount).toBe(1205.59);
    expect(r.detectedPayFrequency).toBe("weekly");
  });

  it("does not treat pay-period dates as money on a combined gross line", () => {
    const raw = `Pay Period From: 20/11/2025 To: 26/11/2025 GROSS PAY: $995.70
Annual Salary: $65,583.44`;
    const r = parsePayslipIncomeFromText(raw);
    expect(r.detectedIncomeAmount).toBe(995.7);
    expect(r.detectedPayFrequency).toBe("weekly");
    expect(r.amountSource).toBe("gross");
  });

  it("uses annual salary when no weekly/fortnightly gross tier applies", () => {
    const raw = `Annual Salary $78,000.00`;
    const r = parsePayslipIncomeFromText(raw);
    expect(r.detectedIncomeAmount).toBe(78000);
    expect(r.detectedPayFrequency).toBe("annual");
    expect(r.amountSource).toBe("annual");
  });

  it("uses gross with monthly pay period when inferred from dates", () => {
    const raw = `Pay period from 01/01/2024 to 31/01/2024
Total Gross $5,000.00`;
    const r = parsePayslipIncomeFromText(raw);
    expect(r.detectedIncomeAmount).toBe(5000);
    expect(r.detectedPayFrequency).toBe("monthly");
    expect(r.amountSource).toBe("gross");
  });

  it("falls back to net pay when no gross or annual line exists", () => {
    const raw = `Net Pay $950.50`;
    const r = parsePayslipIncomeFromText(raw);
    expect(r.detectedIncomeAmount).toBeCloseTo(950.5, 5);
    expect(r.amountSource).toBe("net");
    expect(r.notes.some((n) => n.includes("NET"))).toBe(true);
  });

  it("respects explicit weekly wording on the gross line", () => {
    const raw = `Gross Pay per week $800`;
    const r = parsePayslipIncomeFromText(raw);
    expect(r.detectedIncomeAmount).toBe(800);
    expect(r.detectedPayFrequency).toBe("weekly");
    expect(r.amountSource).toBe("gross");
  });

  it("uses gross earnings with pay frequency on another line", () => {
    const raw = `Gross Earnings £3,000.00
Pay Frequency: Monthly`;
    const r = parsePayslipIncomeFromText(raw);
    expect(r.detectedIncomeAmount).toBe(3000);
    expect(r.detectedPayFrequency).toBe("monthly");
    expect(r.amountSource).toBe("gross");
    expect(r.notes.some((n) => n.includes("document wording"))).toBe(true);
  });

  it("uses bi-weekly wording as fortnightly pay", () => {
    const raw = `Total Gross $2,400.00
Pay Frequency: Bi-weekly`;
    const r = parsePayslipIncomeFromText(raw);
    expect(r.detectedIncomeAmount).toBe(2400);
    expect(r.detectedPayFrequency).toBe("fortnightly");
    expect(normalizeIncomeToWeekly(r.detectedIncomeAmount!, r.detectedPayFrequency)).toBe(1200);
  });

  it("keeps candidates bounded", () => {
    const lines = Array.from({ length: 12 }, (_, i) => `Gross Pay $${1000 + i}.00`);
    const r = parsePayslipIncomeFromText(lines.join("\n"));
    expect(r.candidates.length).toBeLessThanOrEqual(5);
  });
});
