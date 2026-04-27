import { createSupabaseServerClient } from "@/lib/supabase/server";
import { processApplicantPdfBuffer } from "@/lib/pdf/process-applicant-pdf-buffer";
import { normalizeDocumentKeys } from "@/lib/db/mappers";
import { documentKeyCategory } from "@/lib/document-categories";
import { DOCUMENT_KEYS, type DocumentKey } from "@/lib/types";
import {
  mergeReferenceLetterFieldsFromAnalyzeResults,
  recommendationSentimentToReferenceQuality,
} from "@/lib/rental-history-from-pdf";

export const runtime = "nodejs";

type StoredDocRow = {
  document_key: string;
  storage_path: string;
  original_filename: string | null;
};

function toDocumentKey(value: string): DocumentKey | null {
  return DOCUMENT_KEYS.includes(value as DocumentKey) ? (value as DocumentKey) : null;
}

function isDebugEnabled(requested: boolean): boolean {
  // Enable by request flag, explicit env var, or local dev default.
  if (requested) return true;
  if (process.env.PDF_REANALYZE_DEBUG === "1") return true;
  return process.env.NODE_ENV !== "production";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as
      | { applicantId?: string; debug?: boolean }
      | null;
    const applicantId = body?.applicantId?.trim();
    const debug = isDebugEnabled(body?.debug === true);
    if (!applicantId) {
      return Response.json({ error: "Missing applicantId" }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: applicant, error: applicantError } = await supabase
      .from("applicants")
      .select("id, property_id, weekly_income, submitted_documents, rental_history, manual_review")
      .eq("id", applicantId)
      .single();

    if (applicantError || !applicant) {
      return Response.json({ error: "Applicant not found" }, { status: 404 });
    }

    const { data: property, error: propertyError } = await supabase
      .from("properties")
      .select("required_documents")
      .eq("id", applicant.property_id)
      .single();

    if (propertyError || !property) {
      return Response.json({ error: "Property not found" }, { status: 404 });
    }

    const { data: docs, error: docsError } = await supabase
      .from("applicant_documents")
      .select("document_key, storage_path, original_filename")
      .eq("applicant_id", applicantId);

    if (docsError) {
      return Response.json({ error: docsError.message }, { status: 500 });
    }

    const requiredDocuments = normalizeDocumentKeys(property.required_documents ?? []);
    const existingSubmitted = normalizeDocumentKeys(applicant.submitted_documents ?? []);
    const mappedFromAnalyze: DocumentKey[] = [];
    const analyzeResults: Array<{
      displayType: "payslip" | "bank_statement" | "employment_letter" | "rental_history" | "references" | "photo_id" | "unknown";
      extractionStatus: "success" | "failed";
      errorMessage?: string;
      monthsRenting: number | null;
      recommendationSentiment: "strong" | "neutral" | "negative" | null;
      weeklyIncome: number | null;
      needsReview: boolean;
    }> = [];

    let nextWeeklyIncome = Math.max(0, Number(applicant.weekly_income) || 0);

    let downloadFailures = 0;
for (const doc of (docs ?? []) as StoredDocRow[]) {
  const { data: fileBlob, error: downloadError } = await supabase.storage
    .from("applicant-documents")
    .download(doc.storage_path);
  if (downloadError || !fileBlob) {
    downloadFailures++;
    continue;
  }

  const buffer = Buffer.from(await fileBlob.arrayBuffer());
  const documentKey = toDocumentKey(doc.document_key);
  const analyzed = await processApplicantPdfBuffer(buffer, {
    filename: doc.original_filename,
    documentKey,
    slot: doc.document_key,
  });

  if (
    debug &&
    (doc.document_key === "references" ||
      doc.document_key === "rental_history" ||
      analyzed.displayType === "references" ||
      analyzed.displayType === "rental_history")
  ) {
    console.info(
      "[reanalyze-stored][rental-debug]",
      JSON.stringify({
        applicantId,
        storagePath: doc.storage_path,
        originalFilename: doc.original_filename,
        documentKey: doc.document_key,
        analyzedDisplayType: analyzed.displayType,
        analyzedExtractionStatus: analyzed.extractionStatus,
        ...(analyzed.errorMessage ? { analyzedErrorMessage: analyzed.errorMessage } : {}),
        analyzedMonthsRenting: analyzed.monthsRenting,
        analyzedRecommendationSentiment: analyzed.recommendationSentiment,
        needsReview: analyzed.needsReview,
      }),
    );
  }

  mappedFromAnalyze.push(...analyzed.mappedDocumentKeys);
  if (analyzed.extractionStatus === "success" && analyzed.weeklyIncome != null && analyzed.weeklyIncome > 0) {
    nextWeeklyIncome = Math.max(nextWeeklyIncome, Math.round(analyzed.weeklyIncome));
  }
  analyzeResults.push({
    displayType: analyzed.displayType,
    extractionStatus: analyzed.extractionStatus,
    ...(analyzed.errorMessage ? { errorMessage: analyzed.errorMessage } : {}),
    monthsRenting: analyzed.monthsRenting,
    recommendationSentiment: analyzed.recommendationSentiment,
    weeklyIncome: analyzed.weeklyIncome,
    needsReview: analyzed.needsReview,
  });
}

    const nextManualReview = {
      incomeExtractionFailed:
        analyzeResults.some((r) => r.displayType === "payslip") &&
        !analyzeResults.some(
          (r) =>
            r.displayType === "payslip" &&
            r.extractionStatus === "success" &&
            (r.weeklyIncome ?? 0) > 0,
        ),
      referenceExtractionFailed:
        analyzeResults.some((r) => r.displayType === "references" || r.displayType === "rental_history") &&
        analyzeResults.some(
          (r) =>
            (r.displayType === "references" || r.displayType === "rental_history") &&
            (r.extractionStatus === "failed" || r.needsReview),
        ),
    };
    const currentManualReviewRaw =
      applicant.manual_review && typeof applicant.manual_review === "object"
        ? (applicant.manual_review as Record<string, unknown>)
        : {};
    const currentManualReview = {
      incomeExtractionFailed: currentManualReviewRaw.incomeExtractionFailed === true,
      referenceExtractionFailed: currentManualReviewRaw.referenceExtractionFailed === true,
    };

    // For completeness, only required categories matter, but for evidence, keep all
    const allEvidence = Array.from(new Set([...existingSubmitted, ...mappedFromAnalyze]));
    const requiredCategories = new Set(requiredDocuments.map(documentKeyCategory));
    const nextSubmitted = allEvidence.filter((d) => requiredCategories.has(documentKeyCategory(d)));

    const mergedReference = mergeReferenceLetterFieldsFromAnalyzeResults(analyzeResults);
    const currentRental =
      applicant.rental_history && typeof applicant.rental_history === "object"
        ? { ...(applicant.rental_history as Record<string, unknown>) }
        : {};

    if (mergedReference.monthsRenting != null && mergedReference.monthsRenting > 0) {
      const currentMonthsRaw = currentRental.monthsRenting;
      const currentMonths =
        typeof currentMonthsRaw === "number" && Number.isFinite(currentMonthsRaw) && currentMonthsRaw > 0
          ? currentMonthsRaw
          : null;
      currentRental.monthsRenting =
        currentMonths == null
          ? mergedReference.monthsRenting
          : Math.max(currentMonths, mergedReference.monthsRenting);
    }
    if (mergedReference.recommendationSentiment != null) {
      currentRental.recommendationSentiment = mergedReference.recommendationSentiment;
      currentRental.referenceQuality = recommendationSentimentToReferenceQuality(
        mergedReference.recommendationSentiment,
      );
    }

    const submittedChanged =
      nextSubmitted.length !== existingSubmitted.length || nextSubmitted.some((d, idx) => d !== existingSubmitted[idx]);
    const weeklyIncomeChanged = nextWeeklyIncome !== Math.max(0, Number(applicant.weekly_income) || 0);
    const rentalChanged =
      currentRental.monthsRenting !== (applicant.rental_history as Record<string, unknown> | null)?.monthsRenting ||
      currentRental.recommendationSentiment !==
        (applicant.rental_history as Record<string, unknown> | null)?.recommendationSentiment ||
      currentRental.referenceQuality !== (applicant.rental_history as Record<string, unknown> | null)?.referenceQuality;
    const manualReviewChanged =
      currentManualReview.incomeExtractionFailed !== nextManualReview.incomeExtractionFailed ||
      currentManualReview.referenceExtractionFailed !== nextManualReview.referenceExtractionFailed;

    const updated = submittedChanged || weeklyIncomeChanged || rentalChanged || manualReviewChanged;
    if (updated) {
      const { error: updateError } = await supabase
        .from("applicants")
        .update({
          submitted_documents: nextSubmitted,
          weekly_income: nextWeeklyIncome,
          rental_history: currentRental,
          manual_review: nextManualReview,
        })
        .eq("id", applicantId);
      if (updateError) {
        return Response.json({ error: updateError.message }, { status: 500 });
      }
    }

    return Response.json({ updated, downloadFailures });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected re-analysis error";
    return Response.json({ error: message }, { status: 500 });
  }
}
