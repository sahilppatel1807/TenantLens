import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { analyzePayslipPdfBuffer } from "./index";

const runPdfFixtureTests = process.env.RUN_PDF_INCOME_FIXTURE_TESTS === "1";
const fixturesDir = join(process.cwd(), "local-pdf-fixtures");

describe.skipIf(!runPdfFixtureTests)(
  "analyzePayslipPdfBuffer (local PDF fixtures)",
  () => {
    const pdfFiles = existsSync(fixturesDir)
      ? readdirSync(fixturesDir).filter((f) => f.toLowerCase().endsWith(".pdf"))
      : [];

    it.skipIf(pdfFiles.length === 0)(
      "fixture payslips yield positive weekly income (text layer)",
      async () => {
        for (const name of pdfFiles) {
          const buf = readFileSync(join(fixturesDir, name));
          const result = await analyzePayslipPdfBuffer(buf);
          expect(result.rawText.length, `${name}: rawText`).toBeGreaterThan(0);
          expect(result.weeklyIncome, `${name}: weeklyIncome`).not.toBeNull();
          expect(result.weeklyIncome!, `${name}: weeklyIncome > 0`).toBeGreaterThan(0);
          expect(result.confidence, `${name}: confidence`).not.toBe("low");
        }
      },
    );
  },
);
