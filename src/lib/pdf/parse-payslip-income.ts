import { extractPdfText } from "./extract-pdf-text";
import type {
  IncomeConfidence,
  PayFrequency,
  PayslipAmountSource,
  PayslipIncomeCandidate,
  PayslipIncomeParse,
  PayslipIncomeResult,
} from "./types";

const MAX_CANDIDATES = 5;

type LabelKind = "annual" | "gross" | "net";

/** Optional currency symbol; amounts may appear with $, £, €, or none (text layer). */
const MONEY_RE = /(?:\$|£|€)?\s*([\d,]+(?:\.\d{1,2})?)/gi;

/** Parse first / all money tokens in a string (commas stripped). */
export function parseMoneyAUD(text: string): number[] {
  const out: number[] = [];
  const re = new RegExp(MONEY_RE.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const n = Number.parseFloat(m[1].replace(/,/g, ""));
    if (!Number.isNaN(n)) out.push(n);
  }
  return out;
}

const EXPLICIT_CURRENCY_RE = /(?:\$|£|€)\s*([\d,]+(?:\.\d{1,2})?)/gi;

/** Money tokens with an explicit currency symbol (avoids treating `20/11/2025` as money). */
export function parseMoneyAUDExplicitDollar(text: string): number[] {
  const out: number[] = [];
  const re = new RegExp(EXPLICIT_CURRENCY_RE.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const n = Number.parseFloat(m[1].replace(/,/g, ""));
    if (!Number.isNaN(n)) out.push(n);
  }
  return out;
}

function lastMoneyOnLine(line: string): number | null {
  const amounts = parseMoneyAUD(line);
  if (amounts.length === 0) return null;
  return amounts[amounts.length - 1] ?? null;
}

/**
 * For labeled income rows, multi-column payslips often put "this pay" first and YTD
 * second (e.g. "Total Gross $1,205.59 $31,669.81"). Prefer the period column.
 */
function moneyOnLineForIncomeLabel(line: string): number | null {
  let amounts = parseMoneyAUDExplicitDollar(line);
  if (amounts.length === 0) amounts = parseMoneyAUD(line);
  if (amounts.length === 0) return null;
  if (amounts.length >= 2) return amounts[0] ?? null;
  return amounts[0] ?? null;
}

function moneyOnLineOrNext(lines: string[], i: number): number | null {
  const onLine = moneyOnLineForIncomeLabel(lines[i] ?? "");
  if (onLine != null) return onLine;
  return moneyOnLineForIncomeLabel(lines[i + 1] ?? "");
}

function parseFlexibleDate(fragment: string): Date | null {
  const clean = fragment.trim().split(/\s+/)[0] ?? "";
  if (!clean) return null;

  let m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(clean);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const dt = new Date(y, mo - 1, d);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/.exec(clean);
  if (m) {
    const d = Number(m[1]);
    const mo = Number(m[2]);
    let y = Number(m[3]);
    if (y < 100) y += 2000;
    const dt = new Date(y, mo - 1, d);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  const t = Date.parse(clean);
  if (!Number.isNaN(t)) return new Date(t);
  return null;
}

/** Inclusive day count between pay-period bounds (best-effort). */
function inclusiveDayDiff(a: Date, b: Date): number {
  const start = a.getTime() <= b.getTime() ? a : b;
  const end = a.getTime() <= b.getTime() ? b : a;
  const ms = end.getTime() - start.getTime();
  const whole = Math.round(ms / (1000 * 60 * 60 * 24));
  return whole + 1;
}

/**
 * Infer pay-period length in days from phrases like "Pay period from … to …".
 */
export function inferPayPeriodDays(rawText: string): number | null {
  const normalized = rawText.replace(/\r\n/g, "\n");
  const lower = normalized.toLowerCase();
  const idx = lower.search(/pay\s+period/);
  // Include text before the label so "DD.MM.YYYY … Pay Period … DD.MM.YYYY" fits in-window.
  const windowStart = idx >= 0 ? Math.max(0, idx - 120) : 0;
  const windowEnd = idx >= 0 ? idx + 500 : 500;
  const window =
    idx >= 0 ? normalized.slice(windowStart, windowEnd) : normalized.slice(0, 500);

  const tryPair = (a: string, b: string): number | null => {
    const d1 = parseFlexibleDate(a);
    const d2 = parseFlexibleDate(b);
    if (!d1 || !d2) return null;
    const days = inclusiveDayDiff(d1, d2);
    if (days < 1 || days > 400) return null;
    return days;
  };

  // "Pay Period From: 20/11/2025 To: 26/11/2025" (optional colons)
  let ft =
    /from\s*:?\s*([^\n]+?)\s+to\s*:?\s*([^\n]+?)(?:\n|$|,|;|\s{2,})/i.exec(
      window,
    );
  if (ft) {
    const days = tryPair(ft[1], ft[2]);
    if (days != null) return days;
  }

  // "09.03.2026  Pay Period  15.03.2026" (dates around label, common in AU exports)
  ft =
    /(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})\s+pay\s+period\s+(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/i.exec(
      window,
    );
  if (ft) {
    const days = tryPair(ft[1], ft[2]);
    if (days != null) return days;
  }

  return null;
}

function frequencyFromLine(line: string): PayFrequency {
  const l = line.toLowerCase();
  if (
    /\bweekly\b/.test(l) ||
    /\bper\s+week\b/.test(l) ||
    /\/\s*week\b/.test(l)
  ) {
    return "weekly";
  }
  if (
    /\bfortnightly\b/.test(l) ||
    /\bper\s+fortnight\b/.test(l) ||
    /\bbi-?weekly\b/.test(l) ||
    /\bbiweekly\b/.test(l)
  ) {
    return "fortnightly";
  }
  if (/\bmonthly\b/.test(l) || /\bper\s+month\b/.test(l)) {
    return "monthly";
  }
  if (/\bannual(ly)?\b/.test(l) || /\bper\s+year\b/.test(l)) {
    return "annual";
  }
  return "unknown";
}

/**
 * Many payroll PDFs put pay frequency on its own line; `frequencyFromLine` only sees the
 * income label row, so gross can parse while frequency stays unknown → no weekly figure.
 */
export function inferPayFrequencyFromDocument(rawText: string): PayFrequency {
  const text = rawText.replace(/\r\n/g, "\n");
  const mapPhrase = (phrase: string): PayFrequency => {
    const w = phrase.toLowerCase().replace(/\s+/g, " ").trim();
    const head = (w.split(/[,(]/)[0] ?? w).trim();
    if (!head) return "unknown";
    if (/^weekly\b|^w\/?e\b|^each\s+week/.test(head)) return "weekly";
    if (
      /^fortnight/.test(head) ||
      /^fortnightly/.test(head) ||
      /^bi-?weekly/.test(head) ||
      /^biweekly/.test(head) ||
      /^every\s+2\s+weeks?/.test(head)
    ) {
      return "fortnightly";
    }
    if (/^monthly|^every\s+month|^per\s+month/.test(head)) return "monthly";
    if (/^annual|^yearly|^per\s+year/.test(head)) return "annual";
    return "unknown";
  };

  const linePatterns = [
    /pay\s+frequency\s*[:\t .-]+\s*([^\n\r,;]{1,48})/gi,
    /payment\s+frequency\s*[:\t .-]+\s*([^\n\r,;]{1,48})/gi,
    /pay\s+period\s+type\s*[:\t .-]+\s*([^\n\r,;]{1,48})/gi,
    /frequency\s+of\s+pay\s*[:\t .-]+\s*([^\n\r,;]{1,48})/gi,
    /pay\s+cycle\s*[:\t .-]+\s*([^\n\r,;]{1,48})/gi,
  ];
  for (const re of linePatterns) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const f = mapPhrase(m[1] ?? "");
      if (f !== "unknown") return f;
    }
  }

  if (/paid\s+every\s+week\b/i.test(text) || /\bweekly\s+pay\b/i.test(text)) {
    return "weekly";
  }
  if (/\bfortnightly\s+pay\b/i.test(text)) return "fortnightly";
  if (/\bmonthly\s+pay\b/i.test(text)) return "monthly";
  return "unknown";
}

function frequencyFromPeriodDays(days: number | null): PayFrequency {
  if (days == null) return "unknown";
  if (days >= 6 && days <= 8) return "weekly";
  if (days >= 13 && days <= 15) return "fortnightly";
  if (days >= 27 && days <= 32) return "monthly";
  return "unknown";
}

function labelOnLine(line: string): LabelKind | null {
  const l = line.toLowerCase();
  if (
    /\bannual\s+salary\b/.test(l) ||
    /\bsalary\b[^\n]{0,40}\bannual\b/.test(l) ||
    /\bbase\s+salary\b[^\n]{0,40}\bannual\b/.test(l)
  ) {
    return "annual";
  }
  if (
    /\bgross\s+pay\b/.test(l) ||
    /\bgross\s+earnings?\b/.test(l) ||
    /\bgross\s+wages?\b/.test(l) ||
    /\bgross\s+payment\b/.test(l) ||
    /\btotal\s+gross\b/.test(l) ||
    /\btotal\s+earnings?\b/.test(l) ||
    /\bearnings\s+before\s+tax\b/.test(l) ||
    /\bordinary\s+time\s+earnings?\b/.test(l) ||
    /\bordinary\b[^\n]{0,24}\bgross\b/.test(l) ||
    /\btaxable\s+gross\b/.test(l)
  ) {
    return "gross";
  }
  if (
    /\bnet\s+pay\b/.test(l) ||
    /\bnet\s+earnings?\b/.test(l) ||
    /\bnet\s+payment\b/.test(l) ||
    /\btotal\s+net\s+pay\b/.test(l) ||
    /\btotal\s+net\b/.test(l) ||
    /\btake\s+home\b/.test(l) ||
    /\bamount\s+payable\b/.test(l) ||
    /\bpay\s+this\s+period\b/.test(l)
  ) {
    return "net";
  }
  return null;
}

function pushCandidate(
  list: PayslipIncomeCandidate[],
  c: PayslipIncomeCandidate,
) {
  list.push(c);
  list.sort((a, b) => b.amount - a.amount);
  if (list.length > MAX_CANDIDATES) list.length = MAX_CANDIDATES;
}

function dedupeCandidates(list: PayslipIncomeCandidate[]): PayslipIncomeCandidate[] {
  const seen = new Set<string>();
  const out: PayslipIncomeCandidate[] = [];
  for (const c of list) {
    const key = `${c.source}|${c.amount}|${c.frequencyHint}|${c.lineSnippet ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
    if (out.length >= MAX_CANDIDATES) break;
  }
  return out;
}

/**
 * Convert a nominal pay amount to an average weekly figure.
 * `unknown` frequency returns null (caller should not divide blindly).
 */
export function normalizeIncomeToWeekly(
  amount: number,
  frequency: PayFrequency,
): number | null {
  if (!Number.isFinite(amount) || amount < 0) return null;
  switch (frequency) {
    case "weekly":
      return amount;
    case "fortnightly":
      return amount / 2;
    case "monthly":
      return (amount * 12) / 52;
    case "annual":
      return amount / 52;
    case "unknown":
    default:
      return null;
  }
}

function pickGrossForTier1(
  grossRows: Array<{ line: string; amount: number; lineIndex: number }>,
  periodDays: number | null,
): { amount: number; line: string } | null {
  if (grossRows.length === 0) return null;
  const freq = frequencyFromPeriodDays(periodDays);
  if (freq === "unknown") return null;
  // Prefer "total gross" / "gross pay" wording, else largest amount.
  const scored = grossRows.map((r) => {
    const l = r.line.toLowerCase();
    let score = r.amount;
    if (/\btotal\s+gross\b/.test(l)) score += 1_000_000;
    else if (/\bgross\s+pay\b/.test(l)) score += 500_000;
    else if (/\bgross\s+earnings?\b/.test(l)) score += 400_000;
    return { ...r, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const top = scored[0];
  return top ? { amount: top.amount, line: top.line } : null;
}

/**
 * Regex / keyword income parse on plain payslip text (no PDF I/O).
 */
export function parsePayslipIncomeFromText(rawText: string): PayslipIncomeParse {
  const notes: string[] = [];
  const candidates: PayslipIncomeCandidate[] = [];
  const lines = rawText.replace(/\r\n/g, "\n").split("\n");

  const periodDays = inferPayPeriodDays(rawText);
  const periodFreq = frequencyFromPeriodDays(periodDays);
  if (periodDays != null) {
    notes.push(`Inferred ${periodDays}-day pay period (${periodFreq}).`);
  }

  const grossRows: Array<{ line: string; amount: number; lineIndex: number }> =
    [];
  const annualRows: Array<{ line: string; amount: number; lineIndex: number }> =
    [];
  const netRows: Array<{ line: string; amount: number; lineIndex: number }> = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const label = labelOnLine(line);
    if (!label) continue;
    const amount = moneyOnLineOrNext(lines, i);
    if (amount == null) continue;
    const freqHint = frequencyFromLine(line);
    const snippet = line.trim().slice(0, 120);

    if (label === "gross") {
      grossRows.push({ line, amount, lineIndex: i });
      pushCandidate(candidates, {
        source: "gross",
        amount,
        frequencyHint: freqHint !== "unknown" ? freqHint : periodFreq,
        lineSnippet: snippet,
      });
    } else if (label === "annual") {
      annualRows.push({ line, amount, lineIndex: i });
      pushCandidate(candidates, {
        source: "annual",
        amount,
        frequencyHint: "annual",
        lineSnippet: snippet,
      });
    } else {
      netRows.push({ line, amount, lineIndex: i });
      pushCandidate(candidates, {
        source: "net",
        amount,
        frequencyHint: freqHint !== "unknown" ? freqHint : periodFreq,
        lineSnippet: snippet,
      });
    }
  }

  let detectedIncomeAmount: number | null = null;
  let detectedPayFrequency: PayFrequency = "unknown";
  let amountSource: PayslipAmountSource = null;

  const tier1 = pickGrossForTier1(grossRows, periodDays);
  if (tier1 && (periodFreq === "weekly" || periodFreq === "fortnightly")) {
    detectedIncomeAmount = tier1.amount;
    detectedPayFrequency = periodFreq;
    amountSource = "gross";
    notes.push(
      `Used GROSS PAY $${tier1.amount} with ${periodFreq} from pay period.`,
    );
  } else if (annualRows.length > 0) {
    annualRows.sort((a, b) => b.amount - a.amount);
    const row = annualRows[0];
    if (row) {
      detectedIncomeAmount = row.amount;
      detectedPayFrequency = "annual";
      amountSource = "annual";
      notes.push(`Used ANNUAL SALARY $${row.amount}.`);
    }
  } else if (grossRows.length > 0) {
    grossRows.sort((a, b) => b.amount - a.amount);
    const row = pickGrossForTier1(grossRows, periodDays) ?? grossRows[0];
    if (row) {
      detectedIncomeAmount = row.amount;
      amountSource = "gross";
      const lineFreq = frequencyFromLine(row.line);
      if (lineFreq !== "unknown") {
        detectedPayFrequency = lineFreq;
        notes.push(`Used GROSS $${row.amount} with line keyword frequency ${lineFreq}.`);
      } else if (periodFreq === "monthly") {
        detectedPayFrequency = "monthly";
        notes.push(
          `Used GROSS $${row.amount} with monthly pay period (${periodDays} days).`,
        );
      } else {
        detectedPayFrequency = "unknown";
        notes.push(
          periodDays == null
            ? `Used GROSS $${row.amount}; pay frequency not inferred.`
            : `Used GROSS $${row.amount}; frequency unclear for ${periodDays}-day period.`,
        );
      }
    }
  } else if (netRows.length > 0) {
    netRows.sort((a, b) => b.amount - a.amount);
    const row = netRows[0];
    if (row) {
      detectedIncomeAmount = row.amount;
      amountSource = "net";
      const lineFreq = frequencyFromLine(row.line);
      detectedPayFrequency =
        lineFreq !== "unknown" ? lineFreq : periodFreq !== "unknown" ? periodFreq : "unknown";
      notes.push(
        `Used NET $${row.amount} (no gross match). Frequency: ${detectedPayFrequency}.`,
      );
    }
  }

  if (
    grossRows.length > 1 &&
    detectedIncomeAmount != null &&
    amountSource === "gross"
  ) {
    notes.push("Multiple gross lines; picked highest-priority / strongest label match.");
  }

  if (
    detectedIncomeAmount != null &&
    detectedPayFrequency === "unknown" &&
    amountSource !== "annual"
  ) {
    const fromDoc = inferPayFrequencyFromDocument(rawText);
    if (fromDoc !== "unknown") {
      detectedPayFrequency = fromDoc;
      notes.push(`Inferred pay frequency ${fromDoc} from document wording.`);
    }
  }

  return {
    detectedIncomeAmount,
    detectedPayFrequency,
    amountSource,
    candidates: dedupeCandidates(candidates),
    notes,
  };
}

function deriveConfidence(
  parse: PayslipIncomeParse,
  weeklyIncome: number | null,
): IncomeConfidence {
  if (!parse.detectedIncomeAmount || weeklyIncome == null) return "low";
  if (parse.amountSource === "annual" || parse.amountSource === "gross") {
    if (parse.detectedPayFrequency !== "unknown") return "high";
    return "medium";
  }
  if (parse.amountSource === "net") {
    return parse.detectedPayFrequency !== "unknown" ? "medium" : "low";
  }
  return "low";
}

/**
 * Payslip income from plain text only (no PDF extraction). Used when text was
 * extracted once elsewhere to avoid double-parsing the buffer.
 */
export function analyzePayslipTextIncome(rawText: string): {
  weeklyIncome: number | null;
  confidence: IncomeConfidence;
} {
  const parsed = parsePayslipIncomeFromText(rawText);
  const weeklyIncome =
    parsed.detectedIncomeAmount != null
      ? normalizeIncomeToWeekly(
          parsed.detectedIncomeAmount,
          parsed.detectedPayFrequency,
        )
      : null;
  const confidence = deriveConfidence(parsed, weeklyIncome);
  return { weeklyIncome, confidence };
}

/**
 * Full pipeline: PDF bytes → text → parse → weekly normalization + confidence.
 */
export async function analyzePayslipPdfBuffer(
  data: Buffer | Uint8Array,
): Promise<PayslipIncomeResult> {
  const rawText = await extractPdfText(data);
  const parsed = parsePayslipIncomeFromText(rawText);
  const weeklyIncome =
    parsed.detectedIncomeAmount != null
      ? normalizeIncomeToWeekly(
          parsed.detectedIncomeAmount,
          parsed.detectedPayFrequency,
        )
      : null;
  const confidence = deriveConfidence(parsed, weeklyIncome);
  return {
    ...parsed,
    rawText,
    weeklyIncome,
    confidence,
  };
}
