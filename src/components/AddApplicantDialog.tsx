import { useId, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { uploadIntakePdfsBestEffort } from "@/lib/applicant-intake-storage";
import { analyzeApplicantPdfFiles, inferAnalyzeIntentFromFilename } from "@/lib/pdf/analyze-applicant-pdfs-client";
import { mergeReferenceLetterFieldsFromAnalyzeResults, recommendationSentimentToReferenceQuality } from "@/lib/rental-history-from-pdf";
import { normalizeDocumentKeys } from "@/lib/db/mappers";
import type { ApplicantPdfAnalyzeResultItem } from "@/lib/pdf/applicant-pdf-analyze-result";
import { useData } from "@/lib/store";
import type { Property } from "@/lib/types";

interface Props {
  property: Property;
  trigger?: React.ReactNode;
}

export const AddApplicantDialog = ({ property, trigger }: Props) => {
  const { addApplicant, refreshData } = useData();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [occupation, setOccupation] = useState("");
  const [selectedPdfFiles, setSelectedPdfFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitStage, setSubmitStage] = useState<"idle" | "analyzing" | "saving">("idle");
  const [historyNotes, setHistoryNotes] = useState("");
  const [agentNotes, setAgentNotes] = useState("");
  const [hasUnknownOrFailedReference, setHasUnknownOrFailedReference] = useState(false);
  const hasSelectedPdfs = selectedPdfFiles.length > 0;
  const fileInputId = useId();

  const reset = () => {
    setHasUnknownOrFailedReference(false);
    setName("");
    setEmail("");
    setPhone("");
    setOccupation("");
    setSelectedPdfFiles([]);
    setHistoryNotes("");
    setAgentNotes("");
    setSubmitStage("idle");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !phone.trim() || !occupation.trim()) {
      toast({
        title: "Missing details",
        description: "Full name, email, phone and occupation are required.",
      });
      return;
    }

    setSubmitting(true);
    setSubmitStage(hasSelectedPdfs ? "analyzing" : "saving");
    try {
      let analyzedWeeklyIncome: number | null = null;
let analyzedResults: ApplicantPdfAnalyzeResultItem[] | null = null;
let localHasUnknownOrFailedReference = false;
let mergedRentalHistory: import("@/lib/types").RentalHistory = {
  yearsRenting: 0,
  onTimePaymentsPct: 0,
  referenceQuality: "none",
  monthsRenting: null,
  recommendationSentiment: null,
};
let submittedDocuments: import("@/lib/types").DocumentKey[] = [];


      if (hasSelectedPdfs) {
        analyzedResults = await analyzeApplicantPdfFiles(
          selectedPdfFiles,
          selectedPdfFiles.map((file) => inferAnalyzeIntentFromFilename(file.name)),
        );
        // Use the max income from all successful payslip results
const positiveIncomes = analyzedResults
  .filter((item) => item.weeklyIncome && item.weeklyIncome > 0)
  .map((item) => item.weeklyIncome!);
analyzedWeeklyIncome = positiveIncomes.length > 0 ? Math.max(...positiveIncomes) : null;
        localHasUnknownOrFailedReference = analyzedResults.some(
          (row) =>
            (row.displayType === "rental_history" || row.displayType === "references") &&
            (row.extractionStatus === "failed" || row.needsReview),
        );
        // Merge rental/reference fields from all successful results
const mergedFields = mergeReferenceLetterFieldsFromAnalyzeResults(analyzedResults);
mergedRentalHistory = {
  yearsRenting: 0,
  onTimePaymentsPct: 0,
  referenceQuality: mergedFields.recommendationSentiment
    ? recommendationSentimentToReferenceQuality(mergedFields.recommendationSentiment)
    : "none",
  monthsRenting: mergedFields.monthsRenting ?? null,
  recommendationSentiment: mergedFields.recommendationSentiment ?? null,
  ...(historyNotes.trim() ? { notes: historyNotes.trim() } : {}),
};

// Build submittedDocuments from successful analysis, intersected with required documents
const allDocKeys = analyzedResults
  .filter((item) => item.extractionStatus === "success" && Array.isArray(item.mappedDocumentKeys))
  .flatMap((item) => item.mappedDocumentKeys);
submittedDocuments = normalizeDocumentKeys(allDocKeys) as import("@/lib/types").DocumentKey[];

setHasUnknownOrFailedReference(localHasUnknownOrFailedReference);
      } else {
        setHasUnknownOrFailedReference(false);
      }

      const resolvedWeeklyIncome = analyzedWeeklyIncome ?? 0;

      setSubmitStage("saving");
      const created = await addApplicant({
        propertyId: property.id,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        occupation: occupation.trim(),
        weeklyIncome: resolvedWeeklyIncome,
        submittedDocuments,
        rentalHistory: mergedRentalHistory,
        notes: agentNotes.trim() || undefined,
      });

      if (selectedPdfFiles.length > 0) {
        const uploadResult = await uploadIntakePdfsBestEffort({
          applicantId: created.id,
          files: selectedPdfFiles,
          analyzeResults: analyzedResults,
        });

        if (uploadResult.uploaded > 0) {
          const reanalyzeRes = await fetch("/api/applicant-pdfs/reanalyze-stored", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ applicantId: created.id }),
          });
          const reanalyzeJson = (await reanalyzeRes.json().catch(() => null)) as { error?: string } | null;
          if (!reanalyzeRes.ok) {
            throw new Error(reanalyzeJson?.error || "Could not refresh applicant data from uploaded PDFs.");
          }
        }

        await refreshData();

        if (uploadResult.failures.length > 0 || localHasUnknownOrFailedReference) {
          toast({
            title: "Applicant added with PDF warnings",
            description: [
              ...uploadResult.failures.map((f) => `${f.filename}: ${f.message}`),
              localHasUnknownOrFailedReference ? "Some references or rental history could not be fully analyzed." : undefined
            ].filter(Boolean).join(" | "),
            variant: "destructive",
          });
        }
      }

      toast({
        title: "Applicant added",
        description:
          selectedPdfFiles.length > 0
            ? hasUnknownOrFailedReference
              ? `${name.trim()} was added and PDFs were auto-processed. Some scanned PDFs may need selectable text for extraction.`
              : `${name.trim()} was added and PDFs were auto-processed.`
            : `${name.trim()} has been added.`,
      });
      reset();
      setOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not add applicant.";
      toast({ title: "Add failed", description: message, variant: "destructive" });
    } finally {
      setSubmitting(false);
      setSubmitStage("idle");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="accent" size="sm"><Plus /> Add applicant</Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add applicant</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" className="sm:col-span-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Olivia Bennett" />
            </Field>
            <Field label="Email">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="olivia@example.com" />
            </Field>
            <Field label="Phone">
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+61 412 555 098" />
            </Field>
            <Field label="Occupation">
              <Input value={occupation} onChange={(e) => setOccupation(e.target.value)} placeholder="UX Designer" />
            </Field>
          </div>

          <div>
            <Label className="text-sm font-semibold">PDFs</Label>
            <div className="mt-3 space-y-2">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <input
                  id={fileInputId}
                  type="file"
                  accept="application/pdf,.pdf"
                  multiple
                  className="sr-only"
                  onChange={(e) => setSelectedPdfFiles(Array.from(e.target.files ?? []))}
                />
                <label
                  htmlFor={fileInputId}
                  className="inline-flex h-9 cursor-pointer items-center rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  Choose PDF files
                </label>
                {selectedPdfFiles.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {selectedPdfFiles.map((file) => (
                      <span
                        key={`${file.name}-${file.size}-${file.lastModified}`}
                        className="inline-flex items-center rounded-md bg-background px-2 py-1 text-xs text-muted-foreground ring-1 ring-border"
                      >
                        {file.name}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                {selectedPdfFiles.length > 0
                  ? `${selectedPdfFiles.length} file${selectedPdfFiles.length === 1 ? "" : "s"} selected`
                  : "No PDF files selected"}
              </p>
            </div>
          </div>

          <div>
            <div className="mt-3">
              <Field label="History notes (optional)">
  {hasSelectedPdfs && hasUnknownOrFailedReference && (
    <div className="mt-2 flex items-center gap-2 text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded p-2">
      <span>⚠️</span>
      <span>Reference extraction failed or needs review. Manual review needed.</span>
    </div>
  )}
                <Textarea rows={2} value={historyNotes} onChange={(e) => setHistoryNotes(e.target.value)} placeholder="Reference from previous agent..." />
              </Field>
            </div>
          </div>

          <Field label="Agent notes (optional)">
            <Textarea rows={2} value={agentNotes} onChange={(e) => setAgentNotes(e.target.value)} placeholder="Wants 12-month lease..." />
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting
                ? submitStage === "analyzing"
                  ? "Analyzing PDFs..."
                  : "Adding..."
                : "Add applicant"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const Field = ({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) => (
  <div className={`space-y-1.5 ${className}`}>
    <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
    {children}
  </div>
);
