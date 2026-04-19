import { describe, expect, it } from "vitest";
import { classifyDocumentFromText } from "./classify-document-from-text";

describe("classifyDocumentFromText", () => {
  it("classifies payslip cues", () => {
    expect(
      classifyDocumentFromText("Employee pay slip\nGross Pay $2,000"),
    ).toBe("payslip");
  });

  it("classifies bank statement cues", () => {
    expect(
      classifyDocumentFromText("Bank Statement\nBSB 123-456 Account 789"),
    ).toBe("bank_statement");
  });

  it("returns unknown for empty text", () => {
    expect(classifyDocumentFromText("   \n\t")).toBe("unknown");
  });

  it("classifies landlord reference letters with To whom it may concern over employment", () => {
    const text = `
      To whom it may concern,
      I am writing as landlord to confirm Jane was an excellent tenant.
      She paid rent on time for the tenancy at 10 Main Street.
    `;
    expect(classifyDocumentFromText(text)).toBe("rental_history");
  });

  it("classifies tenancy and lease language with a generic greeting as rental history", () => {
    const text = `
      Dear Sir or Madam,
      Re: tenancy at 22 Oak Lane. The lease commenced March 2023.
      Rent was paid promptly throughout the residential tenancy.
    `;
    expect(classifyDocumentFromText(text)).toBe("rental_history");
  });

  it("classifies tenant reference phrasing as rental history", () => {
    const text = `
      This tenant reference confirms the applicant maintained the property well.
      Rental reference provided by the landlord for a lease in Sydney.
    `;
    expect(classifyDocumentFromText(text)).toBe("rental_history");
  });

  it("keeps rental history when generic letter also contains employment terms", () => {
    const text = `
      To whom it may concern,
      I am the landlord and property manager for the tenant at this address.
      This letter confirms tenancy details and that rent was paid on time.
      The applicant is employed full time with a stable salary.
    `;
    expect(classifyDocumentFromText(text)).toBe("rental_history");
  });

  it("classifies landlord + lease language as rental history even without 'to whom'", () => {
    const text = `
      Landlord reference for prior lease at 8 River Road.
      The tenant maintained the property and rental payments were made on time.
      This is not an employment verification letter.
    `;
    expect(classifyDocumentFromText(text)).toBe("rental_history");
  });
});
