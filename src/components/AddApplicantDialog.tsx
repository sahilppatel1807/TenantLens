import { useId, useRef, useState } from "react";
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
import {
  collectPdfFilesFromDataTransfer,
  mergeUniquePdfFiles,
} from "@/lib/collect-pdf-files-from-data-transfer";
import { analyzeApplicantPdfFiles } from "@/lib/pdf/analyze-applicant-pdfs-client";
import { APPLICANT_PDF_ANALYZE_MAX_FILES } from "@/lib/pdf/analyze-limits";
import { mergeReferenceLetterFieldsFromAnalyzeResults, recommendationSentimentToReferenceQuality } from "@/lib/rental-history-from-pdf";
import { normalizeDocumentKeys } from "@/lib/db/mappers";
import type { ApplicantPdfAnalyzeResultItem } from "@/lib/pdf/applicant-pdf-analyze-result";
import { useData } from "@/lib/store";
import type { Property } from "@/lib/types";

interface Props {
  property: Property;
  trigger?: React.ReactNode;
}

function applicantNameSlugForExamples(fullName: string): string {
  const t = fullName.trim();
  return t ? t.replace(/\s+/g, "_") : "ApplicantName";
}

function intakeFileListLabel(file: File): string {
  const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
  return rel && rel.length > 0 ? rel : file.name;
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
  const [dropHighlight, setDropHighlight] = useState(false);
  const hasSelectedPdfs = selectedPdfFiles.length > 0;
  const folderInputId = useId();
  const extraFilesInputId = useId();
  const dropZoneRef = useRef<HTMLDivElement>(null);

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
    setDropHighlight(false);
  };

  const appendPdfFiles = (incoming: File[]) => {
    if (incoming.length === 0) return;
    setSelectedPdfFiles((prev) => {
      const merged = mergeUniquePdfFiles(prev, incoming);
      if (merged.length > APPLICANT_PDF_ANALYZE_MAX_FILES) {
        queueMicrotask(() => {
          toast({
            title: "Too many PDFs",
            description: `You can add at most ${APPLICANT_PDF_ANALYZE_MAX_FILES} PDFs per applicant in one go. Extra files were not added.`,
            variant: "destructive",
          });
        });
        return merged.slice(0, APPLICANT_PDF_ANALYZE_MAX_FILES);
      }
      return merged;
    });
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
          undefined,
          name.trim(),
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
              localHasUnknownOrFailedReference ? "Some references or rental history could not be fully analyzed." : undefined,
            ]
              .filter(Boolean)
              .join(" | "),
            variant: "destructive",
          });
        }
      }

      toast({
        title: "Applicant added",
        description:
          selectedPdfFiles.length > 0
            ? localHasUnknownOrFailedReference
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

  const nameSlug = applicantNameSlugForExamples(name);

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
            <Label className="text-sm font-semibold">Application PDFs</Label>
            <p className="mt-1.5 rounded-md border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
              <span className="font-medium">Folder:</span> name the folder you drag in after this applicant (for your own organisation).
              {" "}
              <span className="font-medium">Files:</span> rename each PDF using the same token as{" "}
              <span className="font-medium">Full name</span> above, with underscores instead of spaces — e.g.{" "}
              <code className="rounded bg-background/60 px-1 py-0.5 font-mono text-[11px]">{nameSlug}_passport.pdf</code>
              ,{" "}
              <code className="rounded bg-background/60 px-1 py-0.5 font-mono text-[11px]">{nameSlug}_payslip.pdf</code>
              ,{" "}
              <code className="rounded bg-background/60 px-1 py-0.5 font-mono text-[11px]">{nameSlug}_bank_statement.pdf</code>
              ,{" "}
              <code className="rounded bg-background/60 px-1 py-0.5 font-mono text-[11px]">{nameSlug}_reference.pdf</code>
              . Non-PDF files are ignored. Up to {APPLICANT_PDF_ANALYZE_MAX_FILES} PDFs per add.
            </p>

            <div className="mt-3 space-y-3">
              <input
                id={folderInputId}
                type="file"
                multiple
                {...{ webkitdirectory: "", directory: "" }}
                className="sr-only"
                onChange={(e) => {
                  const list = Array.from(e.target.files ?? []);
                  appendPdfFiles(list);
                  e.target.value = "";
                }}
              />
              <input
                id={extraFilesInputId}
                type="file"
                accept="application/pdf,.pdf"
                multiple
                className="sr-only"
                onChange={(e) => {
                  appendPdfFiles(Array.from(e.target.files ?? []));
                  e.target.value = "";
                }}
              />

              <div
                ref={dropZoneRef}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "copy";
                  setDropHighlight(true);
                }}
                onDragLeave={(e) => {
                  const next = e.relatedTarget as Node | null;
                  if (next && dropZoneRef.current?.contains(next)) return;
                  setDropHighlight(false);
                }}
                onDrop={async (e) => {
                  e.preventDefault();
                  setDropHighlight(false);
                  try {
                    const pdfs = await collectPdfFilesFromDataTransfer(e.dataTransfer);
                    appendPdfFiles(pdfs);
                  } catch {
                    toast({
                      title: "Could not read folder",
                      description: "Try choosing the folder with the button below, or add PDFs individually.",
                      variant: "destructive",
                    });
                  }
                }}
                className={`rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
                  dropHighlight
                    ? "border-primary bg-primary/5"
                    : "border-border bg-muted/30"
                }`}
              >
                <p className="text-sm text-muted-foreground">
                  Drag a <span className="font-medium text-foreground">folder</span> or PDFs here
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  <label
                    htmlFor={folderInputId}
                    className="inline-flex h-9 cursor-pointer items-center rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    Choose folder
                  </label>
                  <label
                    htmlFor={extraFilesInputId}
                    className="inline-flex h-9 cursor-pointer items-center rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    Add PDFs
                  </label>
                </div>
              </div>

              {selectedPdfFiles.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 rounded-lg border border-border bg-muted/20 p-3">
                  {selectedPdfFiles.map((file) => (
                    <span
                      key={`${file.name}-${file.size}-${file.lastModified}`}
                      className="inline-flex max-w-full items-center truncate rounded-md bg-background px-2 py-1 text-xs text-muted-foreground ring-1 ring-border"
                      title={intakeFileListLabel(file)}
                    >
                      {intakeFileListLabel(file)}
                    </span>
                  ))}
                </div>
              ) : null}
              <p className="text-xs text-muted-foreground">
                {selectedPdfFiles.length > 0
                  ? `${selectedPdfFiles.length} PDF${selectedPdfFiles.length === 1 ? "" : "s"} selected`
                  : "No PDFs selected yet"}
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
