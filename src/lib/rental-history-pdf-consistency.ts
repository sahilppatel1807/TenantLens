import type { DocumentKey, RentalHistory } from "@/lib/types";

const PDF_RENTAL_DOC_KEYS: DocumentKey[] = ["rental_history", "references"];

export function shouldClearPdfDerivedRentalFields(
  removedDoc: DocumentKey,
  nextSubmittedDocuments: DocumentKey[],
): boolean {
  if (!PDF_RENTAL_DOC_KEYS.includes(removedDoc)) return false;
  return !nextSubmittedDocuments.some((doc) => PDF_RENTAL_DOC_KEYS.includes(doc));
}

export function rentalHistoryAfterPdfDocRemoval(
  current: RentalHistory,
  removedDoc: DocumentKey,
  nextSubmittedDocuments: DocumentKey[],
): RentalHistory {
  if (!shouldClearPdfDerivedRentalFields(removedDoc, nextSubmittedDocuments)) return current;
  return {
    ...current,
    monthsRenting: null,
    recommendationSentiment: null,
    referenceQuality: "none",
  };
}
