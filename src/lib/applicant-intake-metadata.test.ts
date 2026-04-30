import { describe, expect, it } from "vitest";
import {
  applicantIntakePrefillFromFolderAndMetadata,
  findDuplicateApplicantForProperty,
  normalizeApplicantNameFromFolderName,
  parseApplicantIntakeMetadataFiles,
  parseApplicantIntakeMetadataText,
} from "./applicant-intake-metadata";
import type { Applicant } from "./types";

function applicant(overrides: Partial<Applicant>): Applicant {
  return {
    id: "app-1",
    propertyId: "property-1",
    name: "Sahil Patel",
    email: "sahil@example.com",
    phone: "+61 412 555 098",
    occupation: "",
    weeklyIncome: 0,
    submittedDocuments: [],
    rentalHistory: {
      yearsRenting: 0,
      onTimePaymentsPct: 0,
      referenceQuality: "none",
      monthsRenting: null,
      recommendationSentiment: null,
    },
    appliedAt: "2026-01-01T00:00:00.000Z",
    status: "new",
    ...overrides,
  };
}

function textFile(contents: string, name: string): File {
  return Object.assign(new File([contents], name, { type: "text/plain" }), {
    text: async () => contents,
  });
}

describe("normalizeApplicantNameFromFolderName", () => {
  it("turns separator-heavy folder names into display names", () => {
    expect(normalizeApplicantNameFromFolderName("sahil_patel")).toBe("Sahil Patel");
    expect(normalizeApplicantNameFromFolderName("olivia-bennett application")).toBe("Olivia Bennett Application");
  });
});

describe("parseApplicantIntakeMetadataText", () => {
  it("parses supported key-value metadata and ignores malformed lines", () => {
    expect(
      parseApplicantIntakeMetadataText(`
        Full Name: Olivia Bennett
        Email: olivia@example.com
        Phone: +61 400 000 000
        Occupation: Designer
        Unknown: ignored
        not a pair
      `),
    ).toEqual({
      name: "Olivia Bennett",
      email: "olivia@example.com",
      phone: "+61 400 000 000",
      occupation: "Designer",
    });
  });

  it("parses phone no alias case-insensitively", () => {
    expect(parseApplicantIntakeMetadataText(" PHONE NO : +61 411 222 333 ")).toEqual({
      phone: "+61 411 222 333",
    });
  });

  it("parses common phone no delimiter and punctuation variants", () => {
    expect(parseApplicantIntakeMetadataText("Phone no. = +61 422 333 444")).toEqual({
      phone: "+61 422 333 444",
    });
    expect(parseApplicantIntakeMetadataText("Phone No - 0422 333 444")).toEqual({
      phone: "0422 333 444",
    });
    expect(parseApplicantIntakeMetadataText("Mobile number: 0422 333 444")).toEqual({
      phone: "0422 333 444",
    });
  });

  it("parses a realistic multiline applicant TXT block", () => {
    expect(
      parseApplicantIntakeMetadataText(`
        # Applicant details
        Name - Sahil Patel
        Email Address = sahil@example.com
        Phone no. : +61 412 555 098
        Profession: Real Estate Agent

        Notes: ignored by metadata intake
      `),
    ).toEqual({
      name: "Sahil Patel",
      email: "sahil@example.com",
      phone: "+61 412 555 098",
      occupation: "Real Estate Agent",
    });
  });

  it("parses TXT metadata with carriage-return-only line endings", () => {
    expect(
      parseApplicantIntakeMetadataText(
        "Name: Sahil Patel\rEmail: sp22@gmail.com\rPhone no: +61 232132234\rOccupation: Software Engineer\r",
      ),
    ).toEqual({
      name: "Sahil Patel",
      email: "sp22@gmail.com",
      phone: "+61 232132234",
      occupation: "Software Engineer",
    });
  });

  it("parses applicant/contact label variants", () => {
    expect(
      parseApplicantIntakeMetadataText(`
        Applicant Name: Txt Person
        E-mail: txt@example.com
        Contact Number: +61 433 222 111
        Role: Leasing Consultant
      `),
    ).toEqual({
      name: "Txt Person",
      email: "txt@example.com",
      phone: "+61 433 222 111",
      occupation: "Leasing Consultant",
    });
  });
});

describe("parseApplicantIntakeMetadataFiles", () => {
  it("merges all TXT metadata files without letting later folder notes overwrite earlier details", async () => {
    const details = textFile("Name: Txt Person\nEmail: txt@example.com", "details.txt");
    const notes = textFile("Name: Notes Person\nPhone: +61 400 111 222", "notes.txt");

    await expect(parseApplicantIntakeMetadataFiles([details, notes])).resolves.toEqual({
      name: "Txt Person",
      email: "txt@example.com",
      phone: "+61 400 111 222",
    });
  });
});

describe("applicantIntakePrefillFromFolderAndMetadata", () => {
  it("lets TXT metadata name win over the folder-derived name", () => {
    expect(
      applicantIntakePrefillFromFolderAndMetadata({
        folderName: "folder_person",
        metadata: { name: "Txt Person", email: "txt@example.com" },
      }),
    ).toEqual({
      name: "Txt Person",
      email: "txt@example.com",
    });
  });

  it("falls back to folder-derived name when TXT metadata does not include a name", () => {
    expect(
      applicantIntakePrefillFromFolderAndMetadata({
        folderName: "folder_person",
        metadata: { email: "txt@example.com" },
      }),
    ).toEqual({
      name: "Folder Person",
      email: "txt@example.com",
    });
  });
});

describe("findDuplicateApplicantForProperty", () => {
  it("matches by email within the same property", () => {
    const match = applicant({ id: "same" });
    const otherProperty = applicant({ id: "other", propertyId: "property-2", email: "sahil@example.com" });
    expect(
      findDuplicateApplicantForProperty({
        applicants: [otherProperty, match],
        propertyId: "property-1",
        name: "",
        email: " SAHIL@example.com ",
        phone: "",
      })?.id,
    ).toBe("same");
  });

  it("falls back to normalized name and phone when email is blank", () => {
    expect(
      findDuplicateApplicantForProperty({
        applicants: [applicant({ email: "" })],
        propertyId: "property-1",
        name: "sahil   patel",
        email: "",
        phone: "+61 412 555 098",
      })?.id,
    ).toBe("app-1");
  });
});
