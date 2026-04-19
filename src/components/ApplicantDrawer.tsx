import { useEffect, useState } from "react";
import { PdfIntakeFilePicker } from "./pdf-intake-file-picker";
import { Check, Mail, Pen, Phone, Trash2, X } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScoreRing } from "./ScoreRing";
import { TierBadge } from "./TierBadge";
import { ApplicantStatusActions } from "./ApplicantStatusActions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { analyzeApplicantPdfFiles, inferAnalyzeIntentFromFilename } from "@/lib/pdf/analyze-applicant-pdfs-client";
import { useData } from "@/lib/store";
import { effectiveTenancyMonths, rentalBehaviorLabel, scoreApplicant } from "@/lib/scoring";
import { rentalHistoryAfterPdfDocRemoval, shouldClearPdfDerivedRentalFields } from "@/lib/rental-history-pdf-consistency";
import { DOCUMENT_LABELS, type Applicant, type Property } from "@/lib/types";
import { uploadIntakePdfsBestEffort } from "@/lib/applicant-intake-storage";

interface ApplicantDrawerProps {
  applicant: Applicant | null;
  property: Property | null;
  initialFocus?: "overview" | "edit";
  onClose: () => void;
}

export const ApplicantDrawer = ({ applicant, property, initialFocus = "overview", onClose }: ApplicantDrawerProps) => {
  const { setApplicantStatus, updateApplicant, refreshData, deleteApplicant } = useData();
  const { toast } = useToast();
  const open = Boolean(applicant && property);
  const [mode, setMode] = useState<"overview" | "edit">(initialFocus);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [occupation, setOccupation] = useState("");
  // Phase 2: Remove manual weeklyIncome input
// const [weeklyIncome, setWeeklyIncome] = useState("");
  const [historyNotes, setHistoryNotes] = useState("");
  const [agentNotes, setAgentNotes] = useState("");
  const [selectedPdfFiles, setSelectedPdfFiles] = useState<File[]>([]);
  const [uploadState, setUploadState] = useState<"idle" | "analyzing" | "uploading" | "reanalyzing" | "success" | "error">(
    "idle",
  );
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!applicant) return;
    setMode(initialFocus);
    setName(applicant.name);
    setEmail(applicant.email);
    setPhone(applicant.phone);
    setOccupation(applicant.occupation);
    // setWeeklyIncome(String(applicant.weeklyIncome));
    setHistoryNotes(applicant.rentalHistory.notes ?? "");
    setAgentNotes(applicant.notes ?? "");
    setSelectedPdfFiles([]);
    setUploadState("idle");
    setUploadMessage(null);
  }, [applicant, initialFocus]);

  if (!applicant || !property) {
    return (
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent />
      </Sheet>
    );
  }

  const score = scoreApplicant(applicant, property);
  const submittedSet = new Set(applicant.submittedDocuments);
  const missingDocuments = property.requiredDocuments.filter((doc) => !submittedSet.has(doc));
  const submittedRequiredDocuments = property.requiredDocuments.filter((doc) => submittedSet.has(doc));
  const hasKnownRentalDuration =
    (applicant.rentalHistory.monthsRenting != null && applicant.rentalHistory.monthsRenting > 0) ||
    applicant.rentalHistory.yearsRenting > 0;
  const monthsRented = hasKnownRentalDuration ? effectiveTenancyMonths(applicant.rentalHistory) : null;
  const referenceLabel = rentalBehaviorLabel(applicant.rentalHistory); // Now returns 'Good' or 'None'
  const formChanged =
    name !== applicant.name ||
    email !== applicant.email ||
    phone !== applicant.phone ||
    occupation !== applicant.occupation ||
    // weeklyIncome !== String(applicant.weeklyIncome) ||
    historyNotes !== (applicant.rentalHistory.notes ?? "") ||
    agentNotes !== (applicant.notes ?? "");

  // New: Track if PDF selection changed
  const pdfsChanged = selectedPdfFiles.length > 0;

  const saveEdit = async () => {
    let hadPdfUpload = false;
    let latest = applicant;
    if (!name.trim() || !email.trim()) {
      toast({ title: "Missing details", description: "Name, email and weekly income are required." });
      return;
    }
    setSaving(true);
    try {
      let analyzedResults = null;
      let hasUnknownOrFailedReference = false;
      if (selectedPdfFiles.length > 0) {
        setUploadState("analyzing");
        setUploadMessage("Analyzing selected PDFs...");
        analyzedResults = await analyzeApplicantPdfFiles(
          selectedPdfFiles,
          selectedPdfFiles.map((file) => inferAnalyzeIntentFromFilename(file.name)),
        );
        hasUnknownOrFailedReference = analyzedResults.some(
          (row) =>
            (row.displayType === "rental_history" || row.displayType === "references") &&
            (row.extractionStatus === "failed" || row.needsReview),
        );
        setUploadState("uploading");
        setUploadMessage("Uploading files...");
        const uploadResult = await uploadIntakePdfsBestEffort({
          applicantId: applicant.id,
          files: selectedPdfFiles,
          analyzeResults: analyzedResults,
        });
        setUploadState("reanalyzing");
        setUploadMessage("Re-analyzing applicant data...");
        const reanalyzeRes = await fetch("/api/applicant-pdfs/reanalyze-stored", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ applicantId: applicant.id }),
        });
        const reanalyzeJson = (await reanalyzeRes.json().catch(() => null)) as { error?: string } | null;
        if (!reanalyzeRes.ok) {
          throw new Error(reanalyzeJson?.error || "Could not refresh applicant data from uploaded PDFs.");
        }
        // PHASE 1: Use fresh applicant after PDF upload
        const refreshed = await refreshData();
        hadPdfUpload = selectedPdfFiles.length > 0;
        latest = refreshed?.find((a) => a.id === applicant.id) ?? applicant;
        setSelectedPdfFiles([]);
        setUploadState("success");
        if (uploadResult.failures.length > 0) {
          setUploadMessage(`Uploaded ${uploadResult.uploaded}/${selectedPdfFiles.length} files. Some files failed.`);
          toast({
            title: "Upload completed with warnings",
            description: uploadResult.failures.map((f) => `${f.filename}: ${f.message}`).join(" | "),
            variant: "destructive",
          });
        } else {
          setUploadMessage(
            hasUnknownOrFailedReference
              ? `Uploaded ${uploadResult.uploaded} file${uploadResult.uploaded === 1 ? "" : "s"}. Some files may need selectable-text PDFs for better extraction.`
              : `Uploaded and analyzed ${uploadResult.uploaded} file${uploadResult.uploaded === 1 ? "" : "s"}.`,
          );
          toast({
            title: "PDFs processed",
            description: hasUnknownOrFailedReference
              ? "Applicant data was refreshed. Some files may need selectable text for reference extraction."
              : "Applicant details were refreshed from uploaded documents.",
          });
        }
      }
      await updateApplicant(applicant.id, {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        occupation: occupation.trim(),
        weeklyIncome: hadPdfUpload ? latest.weeklyIncome : applicant.weeklyIncome,
        submittedDocuments: hadPdfUpload ? latest.submittedDocuments : applicant.submittedDocuments,
        rentalHistory: hadPdfUpload ? { ...latest.rentalHistory, notes: historyNotes.trim() || undefined } : {
          yearsRenting: applicant.rentalHistory.yearsRenting,
          onTimePaymentsPct: applicant.rentalHistory.onTimePaymentsPct,
          referenceQuality: applicant.rentalHistory.referenceQuality,
          notes: historyNotes.trim() || undefined,
          monthsRenting: applicant.rentalHistory.monthsRenting,
          recommendationSentiment: applicant.rentalHistory.recommendationSentiment,
        },
        notes: agentNotes.trim() || undefined,
      });
      toast({
        title: "Applicant updated",
        description:
          selectedPdfFiles.length > 0
            ? hasUnknownOrFailedReference
              ? `${name.trim()} was updated and PDFs were auto-processed. Some scanned PDFs may need selectable text for extraction.`
              : `${name.trim()} was updated and PDFs were auto-processed.`
            : `${name.trim()} has been updated.`,
      });
      setMode("overview");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not update applicant.";
      toast({ title: "Update failed", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
      setUploadState("idle");
      setUploadMessage(null);
    }
  };


  const deleteCurrentApplicant = async () => {
    setDeleting(true);
    try {
      await deleteApplicant(applicant.id);
      toast({ title: "Applicant deleted", description: `${applicant.name} has been permanently deleted.` });
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not delete applicant.";
      toast({ title: "Delete failed", description: message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const uploadAndAnalyzePdfs = async () => {
    if (selectedPdfFiles.length === 0) {
      toast({
        title: "No PDFs selected",
        description: "Select one or more PDF files before uploading.",
      });
      return;
    }

    setUploadState("analyzing");
    setUploadMessage("Analyzing selected PDFs...");

    try {
      const analyzeResults = await analyzeApplicantPdfFiles(
        selectedPdfFiles,
        selectedPdfFiles.map((file) => inferAnalyzeIntentFromFilename(file.name)),
      );

      setUploadState("uploading");
      setUploadMessage("Uploading files...");
      const uploadResult = await uploadIntakePdfsBestEffort({
        applicantId: applicant.id,
        files: selectedPdfFiles,
        analyzeResults,
      });

      setUploadState("reanalyzing");
      setUploadMessage("Re-analyzing applicant data...");
      const reanalyzeRes = await fetch("/api/applicant-pdfs/reanalyze-stored", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicantId: applicant.id }),
      });
      const reanalyzeJson = (await reanalyzeRes.json().catch(() => null)) as { error?: string } | null;
      if (!reanalyzeRes.ok) {
        throw new Error(reanalyzeJson?.error || "Could not refresh applicant data from stored PDFs.");
      }

      await refreshData();
      setSelectedPdfFiles([]);
      setUploadState("success");

      if (uploadResult.failures.length > 0) {
        setUploadMessage(`Uploaded ${uploadResult.uploaded}/${selectedPdfFiles.length} files. Some files failed.`);
        toast({
          title: "Upload completed with warnings",
          description: uploadResult.failures.map((f) => `${f.filename}: ${f.message}`).join(" | "),
          variant: "destructive",
        });
      } else {
        const hasUnknownOrFailedReference = analyzeResults.some(
          (row) =>
            row.displayType === "unknown" ||
            (row.displayType === "rental_history" || row.displayType === "references") &&
              row.extractionStatus === "failed",
        );
        setUploadMessage(
          hasUnknownOrFailedReference
            ? `Uploaded ${uploadResult.uploaded} file${uploadResult.uploaded === 1 ? "" : "s"}. Some files may need selectable-text PDFs for better extraction.`
            : `Uploaded and analyzed ${uploadResult.uploaded} file${uploadResult.uploaded === 1 ? "" : "s"}.`,
        );
        toast({
          title: "PDFs processed",
          description: hasUnknownOrFailedReference
            ? "Applicant data was refreshed. Some files may need selectable text for reference extraction."
            : "Applicant details were refreshed from uploaded documents.",
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not process PDFs.";
      setUploadState("error");
      setUploadMessage(message);
      toast({ title: "PDF processing failed", description: message, variant: "destructive" });
    }
  };

  const onRemoveDoc = async (doc: (typeof applicant.submittedDocuments)[number]) => {
    const nextSubmittedDocuments = applicant.submittedDocuments.filter((d) => d !== doc);
    const shouldClear = shouldClearPdfDerivedRentalFields(doc, nextSubmittedDocuments);
    const nextRentalHistory = rentalHistoryAfterPdfDocRemoval(
      applicant.rentalHistory,
      doc,
      nextSubmittedDocuments,
    );
    setSaving(true);
    try {
      await updateApplicant(applicant.id, {
        name: applicant.name,
        email: applicant.email,
        phone: applicant.phone,
        occupation: applicant.occupation,
        weeklyIncome: applicant.weeklyIncome,
        submittedDocuments: nextSubmittedDocuments,
        rentalHistory: {
          ...nextRentalHistory,
          notes: applicant.rentalHistory.notes,
        },
        notes: applicant.notes,
      });
      toast({
        title: "Document removed",
        description: shouldClear
          ? "Rental PDF-derived fields were cleared after removing the last rental/reference document."
          : "Submitted document was removed.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not remove document.";
      toast({ title: "Remove failed", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col overflow-y-auto sm:max-w-lg">
        <SheetTitle className="sr-only">Applicant: {applicant.name}</SheetTitle>
        <div className="text-left">
          <div className="flex items-center gap-4">
            <ScoreRing score={score.total} tier={score.tier} size={64} strokeWidth={6} />
            <div className="min-w-0 flex-1">
              <span className="truncate text-xl">{applicant.name}</span>
              <span className="truncate">
                {applicant.occupation} · Applied {new Date(applicant.appliedAt).toLocaleDateString()}
              </span>
              <div className="mt-2">
                <TierBadge tier={score.tier} />
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => setMode((m) => (m === "edit" ? "overview" : "edit"))}
            >
              <Pen className="h-4 w-4" />
              {mode === "edit" ? "Overview" : "Edit"}
            </Button>
          </div>
        </div>

        {mode === "overview" ? (
          <>
            <div className="mt-4 grid gap-2 rounded-xl bg-secondary/60 p-3 text-sm">
              <a className="flex items-center gap-2 text-foreground hover:underline" href={`mailto:${applicant.email}`}>
                <Mail className="h-4 w-4 text-muted-foreground" />
                {applicant.email}
              </a>
              <a className="flex items-center gap-2 text-foreground hover:underline" href={`tel:${applicant.phone}`}>
                <Phone className="h-4 w-4 text-muted-foreground" />
                {applicant.phone}
              </a>
            </div>

            <Separator className="my-5" />

            <section>
              <h4 className="text-sm font-semibold">Score breakdown</h4>
              <div className="mt-3 space-y-3">
                <ScoreBar label="Document completeness" value={score.completeness} max={50} />
                <ScoreBar label="Income vs rent" value={score.income} max={30} />
                <ScoreBar label="Rental history" value={score.history} max={20} />
              </div>
            </section>

            <Separator className="my-5" />

            <section>
              <h4 className="text-sm font-semibold">Income</h4>
              <p className="mt-1 text-sm text-muted-foreground">
                ${applicant.weeklyIncome}/wk against ${property.weeklyRent}/wk rent ·{" "}
                <span className="font-semibold text-foreground">{score.rentToIncomeRatio.toFixed(1)}x</span>
              </p>
            </section>

            <Separator className="my-5" />

            <section>
              <h4 className="text-sm font-semibold">Submitted documents</h4>
              {submittedRequiredDocuments.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">No submitted required documents.</p>
              ) : (
                <ul className="mt-3 space-y-1.5">
                  {submittedRequiredDocuments.map((doc) => (
                    <li
                      key={doc}
                      className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm"
                    >
                      <span className="text-foreground">{DOCUMENT_LABELS[doc]}</span>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-tier-good">
                          <Check className="h-3.5 w-3.5" /> Submitted
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-muted-foreground hover:text-foreground"
                          onClick={() => void onRemoveDoc(doc)}
                          disabled={saving || deleting}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Remove
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <Separator className="my-5" />

            <section>
  <h4 className="text-sm font-semibold">Rental history</h4>
  <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
    <Stat label="Months rented" value={monthsRented != null ? `${monthsRented} mo` : "Unknown"} />
    <Stat label="Rental behavior" value={referenceLabel} />
  </dl>
  {submittedSet.has("references") && (monthsRented == null || monthsRented === 0) && (
    <div className="mt-2 flex items-center gap-2 text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded p-2">
      <span>⚠️</span>
      <span>Reference extraction failed or needs review. Manual review needed.</span>
    </div>
  )}
</section>

            {applicant.notes && (
              <>
                <Separator className="my-5" />
                <section>
                  <h4 className="text-sm font-semibold">Agent notes</h4>
                  <p className="mt-2 text-sm text-muted-foreground">{applicant.notes}</p>
                </section>
              </>
            )}

            <Separator className="my-5" />

            <section>
              <h4 className="text-sm font-semibold">Missing documents</h4>
              {missingDocuments.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">No missing documents.</p>
              ) : (
                <ul className="mt-3 space-y-1.5">
                  {missingDocuments.map((doc) => (
                    <li
                      key={doc}
                      className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm"
                    >
                      <span className="text-foreground">{DOCUMENT_LABELS[doc]}</span>
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-tier-bad">
                        <X className="h-3.5 w-3.5" /> Missing
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <div className="sticky bottom-0 -mx-6 mt-6 flex items-center justify-between gap-2 border-t border-border bg-background px-6 py-4">
              <Button variant="ghost" onClick={onClose}>
                Close
              </Button>
              <ApplicantStatusActions
                status={applicant.status}
                onChange={(s) => setApplicantStatus(applicant.id, s)}
                size="md"
              />
            </div>
          </>
        ) : (
          <div className="mt-4 space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" className="sm:col-span-2">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Olivia Bennett" />
              </Field>
              <Field label="Email">
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
              <Field label="Phone">
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </Field>
              <Field label="Occupation">
                <Input value={occupation} onChange={(e) => setOccupation(e.target.value)} />
              </Field>
              <Field label="Weekly income (from documents)">
                <div className="py-2 px-3 rounded border bg-muted text-sm">
                  {applicant.weeklyIncome ? `$${applicant.weeklyIncome} / week` : 'Not detected — upload a payslip'}
                </div>
              </Field>
            </div>

            <div>
              <Label className="text-sm font-semibold">Documents submitted</Label>
              {submittedRequiredDocuments.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">No submitted required documents.</p>
              ) : (
                <ul className="mt-3 space-y-1.5">
                  {submittedRequiredDocuments.map((doc) => (
                    <li
                      key={doc}
                      className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm"
                    >
                      <span className="text-foreground">{DOCUMENT_LABELS[doc]}</span>
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-tier-good">
                        <Check className="h-3.5 w-3.5" /> Submitted
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <PdfIntakeFilePicker selectedPdfFiles={selectedPdfFiles} setSelectedPdfFiles={setSelectedPdfFiles} label="Upload applicant PDFs" />
                {uploadMessage ? (
                  <p
                    className={`text-xs ${
                      uploadState === "error"
                        ? "text-tier-bad"
                        : uploadState === "success"
                          ? "text-tier-good"
                          : "text-muted-foreground"
                    }`}
                  >
                    {uploadMessage}
                  </p>
                ) : null}
            </div>

            <div>
              <Label className="text-sm font-semibold">Rental history</Label>
              <div className="mt-3">
                <Field label="History notes (optional)">
                  <Textarea rows={2} value={historyNotes} onChange={(e) => setHistoryNotes(e.target.value)} />
                </Field>
              </div>
            </div>

            <Field label="Agent notes (optional)">
              <Textarea rows={2} value={agentNotes} onChange={(e) => setAgentNotes(e.target.value)} />
            </Field>

            <div className="sticky bottom-0 -mx-6 mt-6 flex items-center justify-between gap-2 border-t border-border bg-background px-6 py-4">
              <Button type="button" variant="ghost" onClick={() => setMode("overview")}>
                Cancel
              </Button>
              <div className="flex items-center gap-2">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="destructive" disabled={saving || deleting}>
                      {deleting ? "Deleting..." : "Delete applicant"}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this applicant?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action permanently deletes {applicant.name}&apos;s profile and cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={deleteCurrentApplicant}
                        disabled={deleting}
                      >
                        {deleting ? "Deleting..." : "Delete applicant"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <Button type="button" disabled={!(formChanged || pdfsChanged) || saving || deleting || uploadState === "analyzing" || uploadState === "uploading" || uploadState === "reanalyzing"} onClick={saveEdit}>
  {uploadState === "analyzing"
    ? "Analyzing PDFs..."
    : uploadState === "uploading"
      ? "Uploading PDFs..."
      : uploadState === "reanalyzing"
        ? "Refreshing applicant data..."
        : saving
          ? "Saving..."
          : "Save applicant"}
</Button>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

const ScoreBar = ({ label, value, max }: { label: string; value: number; max: number }) => (
  <div>
    <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
      <span>{label}</span>
      <span className="text-foreground">
        {value}/{max}
      </span>
    </div>
    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-secondary">
      <div className="h-full rounded-full bg-primary" style={{ width: `${(value / max) * 100}%` }} />
    </div>
  </div>
);

const Stat = ({ label, value, className }: { label: string; value: string; className?: string }) => (
  <div className="rounded-lg border border-border bg-card p-3">
    <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
    <dd className={`mt-0.5 text-sm font-semibold text-foreground ${className ?? ""}`}>{value}</dd>
  </div>
);

const Field = ({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) => (
  <div className={`space-y-1.5 ${className}`}>
    <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
    {children}
  </div>
);
