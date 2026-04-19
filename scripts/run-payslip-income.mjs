#!/usr/bin/env node
/**
 * Dev CLI: read a payslip PDF path and print structured income JSON to stdout.
 * Not imported by the Next app. Run: npm run run:payslip-income -- path/to/file.pdf
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { analyzePayslipPdfBuffer } from "../src/lib/pdf/parse-payslip-income.ts";

const pdfPath = process.argv[2];
if (!pdfPath) {
  console.error("Usage: npm run run:payslip-income -- <path-to-payslip.pdf>");
  process.exit(1);
}

const abs = resolve(process.cwd(), pdfPath);
const buf = readFileSync(abs);
const result = await analyzePayslipPdfBuffer(buf);
console.log(JSON.stringify(result, null, 2));
