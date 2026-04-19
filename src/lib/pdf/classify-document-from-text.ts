import type { ApplicantDocumentDisplayType } from "./types";

type Rule = { type: ApplicantDocumentDisplayType; weight: number; test: (t: string) => boolean };

const RULES: Rule[] = [
  {
    type: "rental_history",
    weight: 6,
    test: (t) =>
      /\bto\s+whom\s+it\s+may\s+concern\b/.test(t) &&
      (/\btenant\b/.test(t) ||
        /\btenancy\b/.test(t) ||
        /\blandlord\b/.test(t) ||
        /\brental\b/.test(t) ||
        /\brent\b/.test(t) ||
        /\bleased\b/.test(t) ||
        /\bproperty\s+manager\b/.test(t)),
  },
  {
    type: "payslip",
    weight: 5,
    test: (t) =>
      /\bpay\s*slip\b/.test(t) ||
      /\bpayslip\b/.test(t) ||
      /\bgross\s+pay\b/.test(t) ||
      /\bnet\s+pay\b/.test(t) ||
      /\bpay\s+period\b/.test(t) ||
      /\bpay\s+frequency\b/.test(t) ||
      /\bbefore\s+tax\s+earnings\b/.test(t) ||
      /\bytd\b/.test(t) ||
      /\btax\s+withheld\b/.test(t) ||
      /\bsuperannuation\b/.test(t) ||
      /\bordinary\s+hours\b/.test(t),
  },
  {
    type: "bank_statement",
    weight: 4,
    test: (t) =>
      /\bbank\s+statement\b/.test(t) ||
      /\baccount\s+summary\b/.test(t) ||
      /\btransaction\s+history\b/.test(t) ||
      (/\bbsb\b/.test(t) && /\baccount\b/.test(t)) ||
      /\bopening\s+balance\b/.test(t) ||
      /\bclosing\s+balance\b/.test(t),
  },
  {
    type: "employment_letter",
    weight: 4,
    test: (t) => {
      const tow = /\bto\s+whom\s+it\s+may\s+concern\b/.test(t);
      const rentalCue =
        /\btenant\b/.test(t) ||
        /\btenancy\b/.test(t) ||
        /\blandlord\b/.test(t) ||
        /\brental\b/.test(t) ||
        /\bleased\b/.test(t);
      return (
        (tow &&
          !rentalCue &&
          (/\bemploy(ed|ment|er|ee)\b/.test(t) ||
            /\bposition\b/.test(t) ||
            /\bsalary\b/.test(t))) ||
        /\bemployment\s+(confirmation|verification|letter)\b/.test(t) ||
        (/\bthis\s+letter\s+confirms\b/.test(t) && /\bemploy(ed|ment)\b/.test(t)) ||
        (/\bsalary\s+of\b/.test(t) && /\bposition\b/.test(t))
      );
    },
  },
  {
    type: "rental_history",
    weight: 5,
    test: (t) =>
      /\btenancy\b/.test(t) ||
      /\blease\s+agreement\b/.test(t) ||
      /\brental\s+ledger\b/.test(t) ||
      /\brental\s+reference\b/.test(t) ||
      /\btenant\s+reference\b/.test(t) ||
      /\blandlord\s+reference\b/.test(t) ||
      /\bprevious\s+tenant\b/.test(t) ||
      /\brented\s+(?:the\s+)?(?:property|premises|unit)\b/.test(t) ||
      (/\brent\b/.test(t) && /\bproperty\s+manager\b/.test(t)),
  },
  {
    type: "references",
    weight: 3,
    test: (t) =>
      /\bcharacter\s+reference\b/.test(t) ||
      /\bprofessional\s+reference\b/.test(t) ||
      /\breference\s+for\b/.test(t) ||
      /\breferee\b/.test(t),
  },
  {
    type: "photo_id",
    weight: 4,
    test: (t) =>
      /\bpassport\b/.test(t) ||
      /\bdriver'?s?\s+licen[cs]e\b/.test(t) ||
      /\blicen[cs]e\s+(no\.?|number)\b/.test(t) ||
      /\bdate\s+of\s+birth\b/.test(t) && /\bexpiry\b/.test(t) ||
      /\bphoto\s+identification\b/.test(t) ||
      /\bproof\s+of\s+age\b/.test(t),
  },
];

/**
 * Keyword / phrase classifier on extracted PDF text (no OCR). Ties break by rule order.
 */
export function classifyDocumentFromText(rawText: string): ApplicantDocumentDisplayType {
  const sample = rawText.slice(0, 50_000).toLowerCase();
  if (!sample.trim()) return "unknown";

  let best: ApplicantDocumentDisplayType = "unknown";
  let bestScore = 0;

  for (const rule of RULES) {
    if (!rule.test(sample)) continue;
    if (rule.weight > bestScore) {
      bestScore = rule.weight;
      best = rule.type;
    }
  }

  return best;
}
