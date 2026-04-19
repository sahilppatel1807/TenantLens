import type { RecommendationSentiment } from "@/lib/types";

export type ReferenceLetterExtraction = {
  monthsRenting: number | null;
  recommendationSentiment: RecommendationSentiment | null;
};

type DateToken = {
  value: Date;
  index: number;
};

const STRONG_RECOMMENDATION_PATTERNS = [
  /\bno\s+issue[s]?\s+recommend(?:ing|ed)?\s+(?:him|her|them)\s+as\s+a\s+tenant\b/i,
  /\bhighly\s+recommend(?:ing|ed)?\s+(?:him|her|them)\s+as\s+a\s+tenant\b/i,
  /\bhighly\s+recommend(?:ed)?\b/i,
  /\bstrongly\s+recommend(?:ed)?\b/i,
  /\bexcellent\s+tenant\b/i,
  /\boutstanding\s+tenant\b/i,
  /\bideal\s+tenant\b/i,
  /\bpaid\s+rent\s+on\s+time\b/i,
  /\balways\s+paid\s+on\s+time\b/i,
  /\bno\s+issues\b/i,
  /\bno\s+complaints\b/i,
];

const NEGATIVE_RECOMMENDATION_PATTERNS = [
  /\bdo\s+not\s+recommend\b/i,
  /\bcannot\s+recommend\b/i,
  /\bnot\s+recommend(?:ed)?\b/i,
  /\blate\s+rent\b/i,
  /\brent\s+arrears?\b/i,
  /\bcomplaint(?:s)?\b/i,
  /\bproperty\s+damage\b/i,
  /\beviction\b/i,
  /\bbreach(?:es)?\b/i,
  /\bconcern(?:s)?\b/i,
];

const NEUTRAL_RECOMMENDATION_PATTERNS = [
  /\brecommend(?:ed)?\b/i,
  /\bsatisfactory\b/i,
  /\bacceptable\b/i,
  /\bcompliant\b/i,
  /\bmet\s+(?:basic\s+)?obligations\b/i,
];

function parseDateToken(raw: string): Date | null {
  const text = raw.trim();

  const dmy = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/;
  const ymd = /^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/;

  let year: number;
  let month: number;
  let day: number;

  if (dmy.test(text)) {
    const match = text.match(dmy);
    if (!match) return null;
    day = Number(match[1]);
    month = Number(match[2]);
    year = Number(match[3]);
  } else if (ymd.test(text)) {
    const match = text.match(ymd);
    if (!match) return null;
    year = Number(match[1]);
    month = Number(match[2]);
    day = Number(match[3]);
  } else {
    return null;
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const value = new Date(Date.UTC(year, month - 1, day));
  if (
    value.getUTCFullYear() !== year ||
    value.getUTCMonth() !== month - 1 ||
    value.getUTCDate() !== day
  ) {
    return null;
  }

  return value;
}

function monthDiffFloor(start: Date, end: Date): number {
  const startYear = start.getUTCFullYear();
  const startMonth = start.getUTCMonth();
  const startDay = start.getUTCDate();

  const endYear = end.getUTCFullYear();
  const endMonth = end.getUTCMonth();
  const endDay = end.getUTCDate();

  let months = (endYear - startYear) * 12 + (endMonth - startMonth);
  if (endDay < startDay) months -= 1;
  return Math.max(months, 0);
}

function extractDateTokens(text: string): DateToken[] {
  const tokens: DateToken[] = [];
  const pattern = /\b(?:\d{1,2}[./-]\d{1,2}[./-]\d{4}|\d{4}[./-]\d{1,2}[./-]\d{1,2})\b/g;

  for (const match of Array.from(text.matchAll(pattern))) {
    if (!match[0]) continue;
    const parsed = parseDateToken(match[0]);
    if (!parsed) continue;
    tokens.push({ value: parsed, index: match.index ?? 0 });
  }

  return tokens.sort((a, b) => a.index - b.index);
}

const WORD_TO_SMALL_INT: Record<string, number> = {
  a: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};

const MONTH_NAME_TO_INDEX: Record<string, number> = {
  january: 0,
  jan: 0,
  february: 1,
  feb: 1,
  march: 2,
  mar: 2,
  april: 3,
  apr: 3,
  may: 4,
  june: 5,
  jun: 5,
  july: 6,
  jul: 6,
  august: 7,
  aug: 7,
  september: 8,
  sep: 8,
  sept: 8,
  october: 9,
  oct: 9,
  november: 10,
  nov: 10,
  december: 11,
  dec: 11,
};

function parseWordOrDigitInt(raw: string): number | null {
  const t = raw.trim().toLowerCase();
  if (/^\d+$/.test(t)) return Number(t);
  return WORD_TO_SMALL_INT[t] ?? null;
}

function parseMonthYearToken(monthRaw: string, yearRaw: string): Date | null {
  const monthIdx = MONTH_NAME_TO_INDEX[monthRaw.trim().toLowerCase()];
  if (monthIdx == null) return null;
  const year = Number(yearRaw);
  if (!Number.isFinite(year) || year < 1900 || year > 2100) return null;
  return new Date(Date.UTC(year, monthIdx, 1));
}

/** Spelled-out or numeric durations, e.g. "twelve months", "two years", "a year". */
function extractMonthsFromSpelledDurations(text: string): number | null {
  let best: number | null = null;
  // Use 'sample' for all regex below
  const sample = text.slice(0, 50_000);

  const consider = (months: number) => {
    if (months > 0 && (best == null || months > best)) best = months;
  };

  // Also handle 'for X year Y months' (no 'and')
  const forYearMonth = /for\s+(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|a)\s+year[s]?\s+(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+month[s]?/gi;
  for (const m of Array.from(sample.matchAll(forYearMonth))) {
    const y = parseWordOrDigitInt(m[1] ?? "");
    const mo = parseWordOrDigitInt(m[2] ?? "");
    if (y != null && mo != null) consider(y * 12 + mo);
  }


  const yearToken =
    String.raw`(?:\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|a)`;
  const monthToken =
    String.raw`(?:\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)`;
  const yearMonthPair =
    new RegExp(`\\b(${yearToken})\\s+years?\\s+and\\s+(${monthToken})\\s+months?\\b`, "gi");
  for (const m of Array.from(sample.matchAll(yearMonthPair))) {
    const y = parseWordOrDigitInt(m[1] ?? "");
    const mo = parseWordOrDigitInt(m[2] ?? "");
    if (y != null && mo != null) consider(y * 12 + mo);
  }

  const digitYears = /\b(\d{1,2})\s+years?\b/gi;
  for (const m of Array.from(sample.matchAll(digitYears))) {
    const y = Number(m[1]);
    if (Number.isFinite(y)) consider(y * 12);
  }

  const wordYears =
    /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|a)\s+years?\b/gi;
  for (const m of Array.from(sample.matchAll(wordYears))) {
    const y = parseWordOrDigitInt(m[1] ?? "");
    if (y != null) consider(y * 12);
  }

  const digitMonths = /\b(\d{1,2})\s+months?\b/gi;
  for (const m of Array.from(sample.matchAll(digitMonths))) {
    const mo = Number(m[1]);
    if (Number.isFinite(mo)) consider(mo);
  }

  const wordMonths =
    /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+months?\b/gi;
  for (const m of Array.from(sample.matchAll(wordMonths))) {
    const mo = parseWordOrDigitInt(m[1] ?? "");
    if (mo != null) consider(mo);
  }

  if (/\b(?:a|one)\s+year\b/i.test(sample)) consider(12);

  return best;
}

/** Ranges like "January 2024 to March 2025" or "Jan 2024 until Dec 2024". */
function extractMonthsFromMonthNameRanges(text: string): number | null {
  const sample = text.slice(0, 50_000);
  const monthPart = String.raw`(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)`;
  const re = new RegExp(
    `\\b(${monthPart})\\s+(\\d{4})\\s*(?:to|until|through|–|-)\\s*(${monthPart})\\s+(\\d{4})\\b`,
    "gi",
  );

  let best: number | null = null;
  for (const m of Array.from(sample.matchAll(re))) {
    const start = parseMonthYearToken(m[1] ?? "", m[2] ?? "");
    const end = parseMonthYearToken(m[3] ?? "", m[4] ?? "");
    if (!start || !end || end < start) continue;
    const months = monthDiffFloor(start, end);
    if (best == null || months > best) best = months;
  }

  return best;
}

function extractMonthsFromSinceMonthYear(text: string): number | null {
  // e.g. 'since March 2023', 'Reference written May 2024'
  const sinceRe = /since\s+([a-zA-Z]+)\s+(\d{4})/i;
  const refRe = /reference written ([a-zA-Z]+)\s+(\d{4})/i;
  const sinceMatch = text.match(sinceRe);
  const refMatch = text.match(refRe);
  if (sinceMatch && refMatch) {
    const start = parseMonthYearToken(sinceMatch[1], sinceMatch[2]);
    const end = parseMonthYearToken(refMatch[1], refMatch[2]);
    if (start && end && end > start) {
      return monthDiffFloor(start, end);
    }
  }
  return null;
}

function extractMonthsFromYYYYMMRange(text: string): number | null {
  // e.g. 'from 2022-03 to 2023-05'
  const re = /from\s+(\d{4})-(\d{2})\s+to\s+(\d{4})-(\d{2})/i;
  const m = text.match(re);
  if (m) {
    const start = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1));
    const end = new Date(Date.UTC(Number(m[3]), Number(m[4]) - 1, 1));
    if (end > start) {
      return monthDiffFloor(start, end);
    }
  }
  return null;
}

function extractMonthsRenting(text: string): number | null {
  const fromNumericDates = (() => {
    const tokens = extractDateTokens(text);
    if (tokens.length < 2) return null;
    let bestRange: number | null = null;
    for (let i = 0; i < tokens.length - 1; i += 1) {
      const start = tokens[i];
      const end = tokens[i + 1];
      if (end.value < start.value) continue;
      const months = monthDiffFloor(start.value, end.value);
      if (bestRange == null || months > bestRange) {
        bestRange = months;
      }
    }
    return bestRange;
  })();

  const fromSpelled = extractMonthsFromSpelledDurations(text);
  const fromMonthNames = extractMonthsFromMonthNameRanges(text);

  const fromSince = extractMonthsFromSinceMonthYear(text);
  const fromYYYYMM = extractMonthsFromYYYYMMRange(text);

  const candidates = [fromNumericDates, fromSpelled, fromMonthNames, fromSince, fromYYYYMM].filter(
    (n): n is number => n != null && n > 0,
  );
  if (candidates.length === 0) return null;
  return Math.max(...candidates);
}

function countMatches(text: string, patterns: RegExp[]): number {
  let hits = 0;
  for (const pattern of patterns) {
    if (pattern.test(text)) hits += 1;
  }
  return hits;
}

function extractRecommendationSentiment(
  text: string,
): RecommendationSentiment | null {
  const strongHits = countMatches(text, STRONG_RECOMMENDATION_PATTERNS);
  const negativeHits = countMatches(text, NEGATIVE_RECOMMENDATION_PATTERNS);
  const neutralHits = countMatches(text, NEUTRAL_RECOMMENDATION_PATTERNS);

  if (negativeHits >= strongHits && negativeHits >= 1) return "negative";
  if (strongHits > negativeHits && strongHits >= 1) return "strong";
  if (neutralHits >= 1) return "neutral";
  return null;
}

export function parseReferenceLetterText(rawText: string): ReferenceLetterExtraction {
  const text = rawText.slice(0, 50_000);
  return {
    monthsRenting: extractMonthsRenting(text),
    recommendationSentiment: extractRecommendationSentiment(text),
  };
}
