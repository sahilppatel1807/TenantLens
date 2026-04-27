import { describe, expect, it } from "vitest";
import { parseReferenceLetterText } from "./parse-reference-letter";

function monthDiffFloorForTest(start: Date, end: Date): number {
  let months =
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (end.getUTCMonth() - start.getUTCMonth());
  if (end.getUTCDate() < start.getUTCDate()) months -= 1;
  return Math.max(months, 0);
}

describe("parseReferenceLetterText", () => {
  it("extracts tenancy months from a DD-MM-YYYY date range", () => {
    const text = `
      This is to confirm Jane Doe rented the property
      from 08-02-2025 to 14-04-2026.
      She was an excellent tenant and paid rent on time.
    `;
    const result = parseReferenceLetterText(text);
    expect(result.monthsRenting).toBe(14);
  });

  it("extracts tenancy months from YYYY/MM/DD date format", () => {
    const text = `
      Tenancy period: 2024/01/15 until 2025/01/15.
      We recommend this tenant.
    `;
    const result = parseReferenceLetterText(text);
    expect(result.monthsRenting).toBe(12);
  });

  it("returns strong recommendation sentiment on positive language", () => {
    const text = "I highly recommend Alex as an outstanding tenant with no complaints.";
    const result = parseReferenceLetterText(text);
    expect(result.recommendationSentiment).toBe("strong");
  });

  it("detects strong recommendation from explicit tenant wording", () => {
    const text = `
      I had no issue recommending him as a tenant.
      I highly recommend her as a tenant.
    `;
    const result = parseReferenceLetterText(text);
    expect(result.recommendationSentiment).toBe("strong");
  });

  it("returns negative recommendation sentiment when concerns are present", () => {
    const text = "There were repeated rent arrears and I do not recommend this tenant.";
    const result = parseReferenceLetterText(text);
    expect(result.recommendationSentiment).toBe("negative");
  });

  it("returns neutral recommendation sentiment for basic recommendation language", () => {
    const text = "This reference confirms the tenant met obligations and is recommended.";
    const result = parseReferenceLetterText(text);
    expect(result.recommendationSentiment).toBe("neutral");
  });

  it("returns nulls when no usable values are present", () => {
    const text = "Reference letter attached.";
    const result = parseReferenceLetterText(text);
    expect(result.monthsRenting).toBeNull();
    expect(result.recommendationSentiment).toBeNull();
  });

  it("extracts months from spelled-out durations", () => {
    const text =
      "The tenant resided for twelve months and was always punctual with rent.";
    const result = parseReferenceLetterText(text);
    expect(result.monthsRenting).toBe(12);
  });

  it("extracts months from year counts", () => {
    const text = "They rented for 2 years with no issues.";
    const result = parseReferenceLetterText(text);
    expect(result.monthsRenting).toBe(24);
  });

  it("extracts mixed spelled-out year and month durations", () => {
    const text = "The tenant lived at the property for one year and six months.";
    const result = parseReferenceLetterText(text);
    expect(result.monthsRenting).toBe(18);
  });

  it("extracts months from month-name date ranges", () => {
    const text =
      "Tenancy ran from January 2024 to March 2025. I recommend them highly.";
    const result = parseReferenceLetterText(text);
    expect(result.monthsRenting).toBe(14);
  });

  it("extracts months from abbreviated month-name ranges with dashes", () => {
    const text =
      "Lease term: Sep 2022 - Dec 2023. The tenant was reliable and paid rent on time.";
    const result = parseReferenceLetterText(text);
    expect(result.monthsRenting).toBe(15);
    expect(result.recommendationSentiment).toBe("strong");
  });

  it("prefers the longest tenure signal across cues", () => {
    const text = `
      Lease period January 2020 to January 2024.
      They also stayed twelve months at another address mentioned elsewhere.
    `;
    const result = parseReferenceLetterText(text);
    expect(result.monthsRenting).toBe(48);
  });
});
// Additional real-world reference formats
it("extracts months from 'since' month-year phrasing", () => {
  const text = `Tenant has resided here since March 2023. Reference written May 2024.`;
  const result = parseReferenceLetterText(text);
  expect(result.monthsRenting).toBe(14); // March 2023 to May 2024
});

it("extracts months from 'for 1 year 3 months' phrasing", () => {
  const text = `The tenant stayed for 1 year 3 months and paid rent on time.`;
  const result = parseReferenceLetterText(text);
  expect(result.monthsRenting).toBe(15);
});

it("extracts months from 'tenancy period: Mar 2023–May 2024'", () => {
  const text = `Tenancy period: Mar 2023–May 2024. No issues.`;
  const result = parseReferenceLetterText(text);
  expect(result.monthsRenting).toBe(14);
});

it("extracts months from 'from 2022-03 to 2023-05' phrasing", () => {
  const text = `Rental from 2022-03 to 2023-05. Good tenant.`;
  const result = parseReferenceLetterText(text);
  expect(result.monthsRenting).toBe(14);
});

it("extracts months from 'since Month Year' when no written date is present", () => {
  const text = `The tenant has rented this unit since March 2023 and has always paid on time.`;
  const result = parseReferenceLetterText(text);
  const nowMonth = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  const expected = monthDiffFloorForTest(new Date(Date.UTC(2023, 2, 1)), nowMonth);
  expect(result.monthsRenting).toBe(expected);
});

it("extracts months from open-ended year ranges like 'from 2022 to present'", () => {
  const text = `Rental period from 2022 to present. The tenant is recommended.`;
  const result = parseReferenceLetterText(text);
  const nowMonth = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  const expected = monthDiffFloorForTest(new Date(Date.UTC(2022, 0, 1)), nowMonth);
  expect(result.monthsRenting).toBe(expected);
});

it("extracts provided reference-letter sample with day-month-year range", () => {
  const text = `
    15-04-2026
    To whom it may concern,
    I would like to inform you that Sahil Patel rented a one-bedroom apartment at 329 walter rd, west
    from 08-02-2025 to 14-04-2026.
    During his/her tenure, he/she paid rent on time and took care of the property.
    He/She informed me that he/she was moving out months in advance and I had no issue
    recommending him/her as a tenant.
    I highly recommend him/her as a tenant.
  `;
  const result = parseReferenceLetterText(text);
  expect(result.monthsRenting).toBe(14);
  expect(result.recommendationSentiment).toBe("strong");
});

it("extracts date ranges even when PDF text wraps inside dates", () => {
  const text = `
    Tenancy period from 08-02-
    2025 to 14 - 04 - 2026.
    Paid rent on time. Highly recommended.
  `;
  const result = parseReferenceLetterText(text);
  expect(result.monthsRenting).toBe(14);
  expect(result.recommendationSentiment).toBe("strong");
});

it("extracts months from day-month-name sentence range", () => {
  const text = `
    Rental period from 1 Jan 2024 to 31 Mar 2025.
    Tenant paid rent on time and was recommended.
  `;
  const result = parseReferenceLetterText(text);
  expect(result.monthsRenting).toBe(14);
});

it("extracts months from abbreviated day-month-name range with hyphen", () => {
  const text = `
    Tenancy period 01 Feb 2023 - 14 Apr 2024.
    No issues and highly recommended.
  `;
  const result = parseReferenceLetterText(text);
  expect(result.monthsRenting).toBe(14);
  expect(result.recommendationSentiment).toBe("strong");
});

it("extracts months from wrapped day-month-name range", () => {
  const text = `
    Tenant occupied the property from 1 Jan
    2024 to 31 Mar 2025 and always paid rent
    on time.
  `;
  const result = parseReferenceLetterText(text);
  expect(result.monthsRenting).toBe(14);
});

it("does not infer tenancy months from unrelated day-month-name dates", () => {
  const text = `
    Date of issue: 1 Jan 2024.
    Date of birth: 31 Mar 1990.
    Character reference attached.
  `;
  const result = parseReferenceLetterText(text);
  expect(result.monthsRenting).toBeNull();
});
