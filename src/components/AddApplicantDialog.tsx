import { useId, useRef, useState } from "react";
import { ArrowLeft, Files, FolderUp, Plus, UserPlus } from "lucide-react";
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
  collectApplicantIntakeGroupsFromDataTransfer,
  collectApplicantIntakeGroupsFromFileList,
  collectApplicantIntakeFilesFromDataTransfer,
  collectApplicantIntakeFilesFromFileList,
  mergeUniquePdfFiles,
  type ApplicantIntakeFileGroup,
} from "@/lib/collect-pdf-files-from-data-transfer";
import {
  applicantIntakePrefillFromFolderAndMetadata,
  findDuplicateApplicantForProperty,
  parseApplicantIntakeMetadataFiles,
  type ApplicantIntakeMetadata,
} from "@/lib/applicant-intake-metadata";
import { analyzeApplicantPdfFiles } from "@/lib/pdf/analyze-applicant-pdfs-client";
import { APPLICANT_PDF_ANALYZE_MAX_FILES } from "@/lib/pdf/analyze-limits";
import { mergeReferenceLetterFieldsFromAnalyzeResults, recommendationSentimentToReferenceQuality } from "@/lib/rental-history-from-pdf";
import { normalizeDocumentKeys } from "@/lib/db/mappers";
import type { ApplicantPdfAnalyzeResultItem } from "@/lib/pdf/applicant-pdf-analyze-result";
import { useData } from "@/lib/store";
import type { DocumentKey, Property, RentalHistory } from "@/lib/types";

interface Props {
  property: Property;
  trigger?: React.ReactNode;
}

type DialogStep = "choice" | "single" | "bulk";

type BulkCandidate = {
  id: string;
  folderName: string | null;
  name: string;
  email: string;
  phone: string;
  occupation: string;
  pdfFiles: File[];
  metadataTextFiles: File[];
  status: "ready" | "saving" | "saved" | "error";
  error?: string;
};

type SaveApplicantInput = {
  name: string;
  email: string;
  phone: string;
  occupation: string;
  pdfFiles: File[];
  historyNotes: string;
  agentNotes: string;
  onStage?: (stage: "analyzing" | "saving") => void;
  updateReferenceWarning?: boolean;
};

function applicantNameSlugForExamples(fullName: string): string {
  const t = fullName.trim();
  return t ? t.replace(/\s+/g, "_") : "ApplicantName";
}

function intakeFileListLabel(file: File): string {
  const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
  return rel && rel.length > 0 ? rel : file.name;
}

export const AddApplicantDialog = ({ property, trigger }: Props) => {
  const { addApplicant, applicants, refreshData } = useData();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<DialogStep>("choice");

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
  const [bulkCandidates, setBulkCandidates] = useState<BulkCandidate[]>([]);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkDropHighlight, setBulkDropHighlight] = useState(false);
  const hasSelectedPdfs = selectedPdfFiles.length > 0;
  const folderInputId = useId();
  const extraFilesInputId = useId();
  const bulkFolderInputId = useId();
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const bulkDropZoneRef = useRef<HTMLDivElement>(null);

  const reset = () => {
    setStep("choice");
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
    setBulkCandidates([]);
    setBulkSubmitting(false);
    setBulkDropHighlight(false);
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

  const applyIntakePrefill = (params: {
    metadata: ApplicantIntakeMetadata;
    prefill: ApplicantIntakeMetadata;
  }) => {
    if (params.metadata.name) {
      setName(params.metadata.name);
    } else if (params.prefill.name) {
      setName((current) => current || params.prefill.name!);
    }

    if (params.metadata.email) setEmail(params.metadata.email);
    if (params.metadata.phone) setPhone(params.metadata.phone);
    if (params.metadata.occupation) setOccupation(params.metadata.occupation);
  };

  const appendApplicantIntakeFiles = async (intake: {
    pdfFiles: File[];
    metadataTextFiles: File[];
    folderName: string | null;
  }) => {
    appendPdfFiles(intake.pdfFiles);
    const metadata = await parseApplicantIntakeMetadataFiles(intake.metadataTextFiles);
    const prefill = applicantIntakePrefillFromFolderAndMetadata({ folderName: intake.folderName, metadata });
    console.debug("[AddApplicantDialog] merged intake prefill", {
      folderName: intake.folderName,
      metadata,
      prefill,
      pdfFiles: intake.pdfFiles.map((file) => intakeFileListLabel(file)),
      metadataTextFiles: intake.metadataTextFiles.map((file) => intakeFileListLabel(file)),
    });
    applyIntakePrefill({ metadata, prefill });
  };

  const appendBulkIntakeGroups = async (groups: ApplicantIntakeFileGroup[]) => {
    if (groups.length === 0) {
      toast({
        title: "No applicant folders found",
        description: "Add folders containing PDFs or TXT applicant details.",
      });
      return;
    }

    const candidates = await Promise.all(
      groups.map(async (group) => {
        const metadata = await parseApplicantIntakeMetadataFiles(group.metadataTextFiles);
        const prefill = applicantIntakePrefillFromFolderAndMetadata({
          folderName: group.folderName,
          metadata,
        });
        return {
          id: group.id,
          folderName: group.folderName,
          name: prefill.name ?? "",
          email: prefill.email ?? "",
          phone: prefill.phone ?? "",
          occupation: prefill.occupation ?? "",
          pdfFiles: group.pdfFiles.slice(0, APPLICANT_PDF_ANALYZE_MAX_FILES),
          metadataTextFiles: group.metadataTextFiles,
          status: "ready" as const,
        };
      }),
    );

    const truncated = groups.some((group) => group.pdfFiles.length > APPLICANT_PDF_ANALYZE_MAX_FILES);
    setBulkCandidates((prev) => {
      const next = new Map(prev.map((candidate) => [candidate.id, candidate]));
      for (const candidate of candidates) {
        const existing = next.get(candidate.id);
        next.set(candidate.id, existing ? {
          ...existing,
          ...candidate,
          name: candidate.name || existing.name,
          email: candidate.email || existing.email,
          phone: candidate.phone || existing.phone,
          occupation: candidate.occupation || existing.occupation,
          pdfFiles: mergeUniquePdfFiles(existing.pdfFiles, candidate.pdfFiles).slice(0, APPLICANT_PDF_ANALYZE_MAX_FILES),
          status: "ready",
          error: undefined,
        } : candidate);
      }
      return Array.from(next.values());
    });

    if (truncated) {
      toast({
        title: "Some PDFs were skipped",
        description: `Each applicant can include up to ${APPLICANT_PDF_ANALYZE_MAX_FILES} PDFs.`,
      });
    }
  };

  const saveApplicant = async (input: SaveApplicantInput) => {
    const trimmedName = input.name.trim();
    const pdfFiles = input.pdfFiles;
    const hasPdfs = pdfFiles.length > 0;

    input.onStage?.(hasPdfs ? "analyzing" : "saving");
    let analyzedWeeklyIncome: number | null = null;
    let analyzedResults: ApplicantPdfAnalyzeResultItem[] | null = null;
    let localHasUnknownOrFailedReference = false;
    let mergedRentalHistory: RentalHistory = {
      yearsRenting: 0,
      onTimePaymentsPct: 0,
      referenceQuality: "none",
      monthsRenting: null,
      recommendationSentiment: null,
    };
    let submittedDocuments: DocumentKey[] = [];

    if (hasPdfs) {
      analyzedResults = await analyzeApplicantPdfFiles(
        pdfFiles,
        undefined,
        trimmedName,
      );
      const positiveIncomes = analyzedResults
        .filter((item) => item.weeklyIncome && item.weeklyIncome > 0)
        .map((item) => item.weeklyIncome!);
      analyzedWeeklyIncome = positiveIncomes.length > 0 ? Math.max(...positiveIncomes) : null;
      localHasUnknownOrFailedReference = analyzedResults.some(
        (row) =>
          (row.displayType === "rental_history" || row.displayType === "references") &&
          (row.extractionStatus === "failed" || row.needsReview),
      );
      const mergedFields = mergeReferenceLetterFieldsFromAnalyzeResults(analyzedResults);
      mergedRentalHistory = {
        yearsRenting: 0,
        onTimePaymentsPct: 0,
        referenceQuality: mergedFields.recommendationSentiment
          ? recommendationSentimentToReferenceQuality(mergedFields.recommendationSentiment)
          : "none",
        monthsRenting: mergedFields.monthsRenting ?? null,
        recommendationSentiment: mergedFields.recommendationSentiment ?? null,
        ...(input.historyNotes.trim() ? { notes: input.historyNotes.trim() } : {}),
      };

      const allDocKeys = analyzedResults
        .filter((item) => item.extractionStatus === "success" && Array.isArray(item.mappedDocumentKeys))
        .flatMap((item) => item.mappedDocumentKeys);
      submittedDocuments = normalizeDocumentKeys(allDocKeys) as DocumentKey[];

      if (input.updateReferenceWarning) {
        setHasUnknownOrFailedReference(localHasUnknownOrFailedReference);
      }
    } else if (input.updateReferenceWarning) {
      setHasUnknownOrFailedReference(false);
    }

    input.onStage?.("saving");
    const duplicate = findDuplicateApplicantForProperty({
      applicants,
      propertyId: property.id,
      name: trimmedName,
      email: input.email,
      phone: input.phone,
    });

    if (duplicate) {
      if (pdfFiles.length === 0) {
        throw new Error(`${duplicate.name} already exists for this property.`);
      }

      const uploadResult = await uploadIntakePdfsBestEffort({
        applicantId: duplicate.id,
        files: pdfFiles,
        analyzeResults: analyzedResults,
      });

      if (uploadResult.uploaded > 0) {
        const reanalyzeRes = await fetch("/api/applicant-pdfs/reanalyze-stored", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ applicantId: duplicate.id }),
        });
        const reanalyzeJson = (await reanalyzeRes.json().catch(() => null)) as { error?: string } | null;
        if (!reanalyzeRes.ok) {
          throw new Error(reanalyzeJson?.error || "Could not refresh applicant data from uploaded PDFs.");
        }
      }

      await refreshData();
      return {
        name: duplicate.name,
        attachedToDuplicate: true,
        warningMessages: [
          ...uploadResult.failures.map((f) => `${f.filename}: ${f.message}`),
          localHasUnknownOrFailedReference ? "Some references or rental history could not be fully analyzed." : undefined,
        ].filter(Boolean) as string[],
        hasReferenceWarning: localHasUnknownOrFailedReference,
      };
    }

    const applicantPayload = {
      propertyId: property.id,
      name: trimmedName,
      email: input.email.trim(),
      phone: input.phone.trim(),
      occupation: input.occupation.trim(),
      weeklyIncome: analyzedWeeklyIncome ?? 0,
      submittedDocuments,
      rentalHistory: mergedRentalHistory,
      notes: input.agentNotes.trim() || undefined,
    };
    console.debug("[AddApplicantDialog] final applicant payload before save", applicantPayload);

    const created = await addApplicant(applicantPayload);
    let warningMessages: string[] = [];

    if (pdfFiles.length > 0) {
      const uploadResult = await uploadIntakePdfsBestEffort({
        applicantId: created.id,
        files: pdfFiles,
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
      warningMessages = [
        ...uploadResult.failures.map((f) => `${f.filename}: ${f.message}`),
        localHasUnknownOrFailedReference ? "Some references or rental history could not be fully analyzed." : undefined,
      ].filter(Boolean) as string[];
    }

    return {
      name: trimmedName,
      attachedToDuplicate: false,
      warningMessages,
      hasReferenceWarning: localHasUnknownOrFailedReference,
    };
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({
        title: "Missing details",
        description: "Full name is required.",
      });
      return;
    }

    setSubmitting(true);
    setSubmitStage(hasSelectedPdfs ? "analyzing" : "saving");
    try {
      const result = await saveApplicant({
        name,
        email,
        phone,
        occupation,
        pdfFiles: selectedPdfFiles,
        historyNotes,
        agentNotes,
        onStage: setSubmitStage,
        updateReferenceWarning: true,
      });
      if (result.warningMessages.length > 0) {
        toast({
          title: result.attachedToDuplicate ? "Files attached with PDF warnings" : "Applicant added with PDF warnings",
          description: result.warningMessages.join(" | "),
          variant: "destructive",
        });
      }
      toast({
        title: result.attachedToDuplicate ? "Files attached" : "Applicant added",
        description: result.attachedToDuplicate
          ? `${selectedPdfFiles.length} PDF${selectedPdfFiles.length === 1 ? "" : "s"} attached to existing applicant ${result.name}.`
          : selectedPdfFiles.length > 0
            ? result.hasReferenceWarning
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

  const submitBulk = async () => {
    const invalid = bulkCandidates.filter((candidate) => !candidate.name.trim());
    if (invalid.length > 0) {
      toast({
        title: "Missing applicant names",
        description: "Every detected applicant needs a name before saving.",
        variant: "destructive",
      });
      return;
    }

    if (bulkCandidates.length === 0) {
      toast({
        title: "No applicants ready",
        description: "Drop or choose applicant folders first.",
      });
      return;
    }

    setBulkSubmitting(true);
    let saved = 0;
    let attached = 0;
    const failures: string[] = [];
    const warnings: string[] = [];

    for (const candidate of bulkCandidates) {
      setBulkCandidates((prev) => prev.map((row) => (
        row.id === candidate.id ? { ...row, status: "saving", error: undefined } : row
      )));
      try {
        const result = await saveApplicant({
          name: candidate.name,
          email: candidate.email,
          phone: candidate.phone,
          occupation: candidate.occupation,
          pdfFiles: candidate.pdfFiles,
          historyNotes: "",
          agentNotes: "",
        });
        saved += result.attachedToDuplicate ? 0 : 1;
        attached += result.attachedToDuplicate ? 1 : 0;
        warnings.push(...result.warningMessages.map((message) => `${result.name}: ${message}`));
        setBulkCandidates((prev) => prev.map((row) => (
          row.id === candidate.id ? { ...row, status: "saved" } : row
        )));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not save applicant.";
        failures.push(`${candidate.name}: ${message}`);
        setBulkCandidates((prev) => prev.map((row) => (
          row.id === candidate.id ? { ...row, status: "error", error: message } : row
        )));
      }
    }

    setBulkSubmitting(false);

    if (failures.length > 0 || warnings.length > 0) {
      toast({
        title: failures.length > 0 ? "Bulk upload finished with issues" : "Bulk upload finished with PDF warnings",
        description: [...failures, ...warnings].slice(0, 4).join(" | "),
        variant: "destructive",
      });
    }

    if (failures.length === 0) {
      toast({
        title: "Bulk upload complete",
        description: `${saved} applicant${saved === 1 ? "" : "s"} added${attached ? `, ${attached} existing applicant${attached === 1 ? "" : "s"} updated` : ""}.`,
      });
      reset();
      setOpen(false);
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
          <DialogTitle>
            {step === "choice" ? "Add applicant" : step === "single" ? "Add single applicant" : "Bulk upload applicants"}
          </DialogTitle>
        </DialogHeader>
        {step === "choice" ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setStep("bulk")}
                className="group rounded-lg border border-border bg-background p-4 text-left shadow-sm transition-colors hover:border-primary/60 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-md bg-accent text-accent-foreground">
                  <FolderUp className="h-5 w-5" />
                </span>
                <span className="mt-4 block text-sm font-semibold text-foreground">Bulk upload applicants</span>
                <span className="mt-1.5 block text-sm leading-5 text-muted-foreground">
                  Drop multiple applicant folders, review detected details, then save them together.
                </span>
              </button>
              <button
                type="button"
                onClick={() => setStep("single")}
                className="group rounded-lg border border-border bg-background p-4 text-left shadow-sm transition-colors hover:border-primary/60 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <UserPlus className="h-5 w-5" />
                </span>
                <span className="mt-4 block text-sm font-semibold text-foreground">Add single applicant</span>
                <span className="mt-1.5 block text-sm leading-5 text-muted-foreground">
                  Enter one applicant manually and attach optional PDFs for automatic processing.
                </span>
              </button>
            </div>
          </div>
        ) : null}
        {step === "single" ? (
        <form onSubmit={submit} className="space-y-5">
          <Button type="button" variant="ghost" size="sm" className="px-0" onClick={() => setStep("choice")} disabled={submitting}>
            <ArrowLeft /> Back
          </Button>
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
                  void appendApplicantIntakeFiles(collectApplicantIntakeFilesFromFileList(list)).catch(() => {
                    toast({
                      title: "Could not read metadata",
                      description: "PDFs were added, but TXT metadata could not be read.",
                      variant: "destructive",
                    });
                  });
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
                    const intake = await collectApplicantIntakeFilesFromDataTransfer(e.dataTransfer);
                    await appendApplicantIntakeFiles(intake);
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
        ) : null}
        {step === "bulk" ? (
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-3">
              <Button type="button" variant="ghost" size="sm" className="px-0" onClick={() => setStep("choice")} disabled={bulkSubmitting}>
                <ArrowLeft /> Back
              </Button>
              {bulkCandidates.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {bulkCandidates.length} applicant{bulkCandidates.length === 1 ? "" : "s"} detected
                </p>
              ) : null}
            </div>

            <input
              id={bulkFolderInputId}
              type="file"
              multiple
              {...{ webkitdirectory: "", directory: "" }}
              className="sr-only"
              onChange={(e) => {
                const list = Array.from(e.target.files ?? []);
                void appendBulkIntakeGroups(collectApplicantIntakeGroupsFromFileList(list)).catch(() => {
                  toast({
                    title: "Could not read folders",
                    description: "TXT metadata could not be read. Try again or add applicants one at a time.",
                    variant: "destructive",
                  });
                });
                e.target.value = "";
              }}
            />

            <div
              ref={bulkDropZoneRef}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
                setBulkDropHighlight(true);
              }}
              onDragLeave={(e) => {
                const next = e.relatedTarget as Node | null;
                if (next && bulkDropZoneRef.current?.contains(next)) return;
                setBulkDropHighlight(false);
              }}
              onDrop={async (e) => {
                e.preventDefault();
                setBulkDropHighlight(false);
                try {
                  const groups = await collectApplicantIntakeGroupsFromDataTransfer(e.dataTransfer);
                  await appendBulkIntakeGroups(groups);
                } catch {
                  toast({
                    title: "Could not read folders",
                    description: "Try choosing a parent folder with the button below.",
                    variant: "destructive",
                  });
                }
              }}
              className={`rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
                bulkDropHighlight
                  ? "border-primary bg-primary/5"
                  : "border-border bg-muted/30"
              }`}
            >
              <Files className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">
                Drop applicant folders here. Each folder becomes one candidate.
              </p>
              <div className="mt-4 flex justify-center">
                <label
                  htmlFor={bulkFolderInputId}
                  className="inline-flex h-9 cursor-pointer items-center rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  Choose parent folder
                </label>
              </div>
            </div>

            {bulkCandidates.length > 0 ? (
              <div className="space-y-3">
                {bulkCandidates.map((candidate, index) => (
                  <div key={candidate.id} className="rounded-lg border border-border bg-background p-3">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">
                          {candidate.folderName ?? `Applicant ${index + 1}`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {candidate.pdfFiles.length} PDF{candidate.pdfFiles.length === 1 ? "" : "s"}
                          {candidate.metadataTextFiles.length > 0 ? `, ${candidate.metadataTextFiles.length} TXT` : ""}
                        </p>
                      </div>
                      <span className={`rounded-md px-2 py-1 text-xs ${
                        candidate.status === "error"
                          ? "bg-destructive/10 text-destructive"
                          : candidate.status === "saved"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                            : "bg-muted text-muted-foreground"
                      }`}>
                        {candidate.status === "saving" ? "Saving" : candidate.status === "saved" ? "Saved" : candidate.status === "error" ? "Needs review" : "Ready"}
                      </span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Full name" className="sm:col-span-2">
                        <Input
                          value={candidate.name}
                          onChange={(e) => {
                            const value = e.target.value;
                            setBulkCandidates((prev) => prev.map((row) => (
                              row.id === candidate.id ? { ...row, name: value, status: "ready", error: undefined } : row
                            )));
                          }}
                          placeholder="Olivia Bennett"
                          disabled={bulkSubmitting}
                        />
                      </Field>
                      <Field label="Email">
                        <Input
                          type="email"
                          value={candidate.email}
                          onChange={(e) => {
                            const value = e.target.value;
                            setBulkCandidates((prev) => prev.map((row) => (
                              row.id === candidate.id ? { ...row, email: value } : row
                            )));
                          }}
                          placeholder="olivia@example.com"
                          disabled={bulkSubmitting}
                        />
                      </Field>
                      <Field label="Phone">
                        <Input
                          value={candidate.phone}
                          onChange={(e) => {
                            const value = e.target.value;
                            setBulkCandidates((prev) => prev.map((row) => (
                              row.id === candidate.id ? { ...row, phone: value } : row
                            )));
                          }}
                          placeholder="+61 412 555 098"
                          disabled={bulkSubmitting}
                        />
                      </Field>
                      <Field label="Occupation" className="sm:col-span-2">
                        <Input
                          value={candidate.occupation}
                          onChange={(e) => {
                            const value = e.target.value;
                            setBulkCandidates((prev) => prev.map((row) => (
                              row.id === candidate.id ? { ...row, occupation: value } : row
                            )));
                          }}
                          placeholder="UX Designer"
                          disabled={bulkSubmitting}
                        />
                      </Field>
                    </div>
                    {candidate.error ? (
                      <p className="mt-2 text-xs text-destructive">{candidate.error}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={bulkSubmitting}>
                Cancel
              </Button>
              <Button type="button" onClick={submitBulk} disabled={bulkSubmitting || bulkCandidates.length === 0}>
                {bulkSubmitting ? "Saving applicants..." : "Save applicants"}
              </Button>
            </DialogFooter>
          </div>
        ) : null}
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
