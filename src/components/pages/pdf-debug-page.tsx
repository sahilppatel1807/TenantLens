"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type DebugAnalyzeSuccessItem = {
  filename: string;
  extractionStatus: "success";
  displayType: string;
  rawTextLength: number;
  rawTextPreview: string;
  payslip: {
    detectedIncomeAmount: number | null;
    detectedPayFrequency: string;
    amountSource: string | null;
    candidates: Array<{
      source: string;
      amount: number;
      frequencyHint: string;
      lineSnippet?: string;
    }>;
    notes: string[];
    rawText: string;
    weeklyIncome: number | null;
    confidence: string;
  };
};

type DebugAnalyzeFailureItem = {
  filename: string;
  extractionStatus: "failed";
  errorMessage: string;
};

type DebugAnalyzeItem = DebugAnalyzeSuccessItem | DebugAnalyzeFailureItem;

export function PdfDebugPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState<DebugAnalyzeItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedLabel = useMemo(() => {
    if (files.length === 0) return "No PDFs selected";
    if (files.length === 1) return files[0]?.name ?? "1 PDF selected";
    return `${files.length} PDFs selected`;
  }, [files]);

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const list = event.target.files;
    if (!list?.length) {
      setFiles([]);
      setResults(null);
      return;
    }
    const next: File[] = [];
    for (let i = 0; i < list.length; i++) {
      const file = list.item(i);
      if (file) next.push(file);
    }
    setFiles(next);
    setResults(null);
    setError(null);
  };

  const onAnalyze = async () => {
    if (files.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      for (const file of files) form.append("files", file);
      const response = await fetch("/api/pdf-debug/analyze", {
        method: "POST",
        body: form,
      });
      const body = (await response.json().catch(() => null)) as
        | { error?: string; results?: DebugAnalyzeItem[] }
        | null;
      if (!response.ok) {
        throw new Error(body?.error ?? `Request failed (${response.status})`);
      }
      setResults(body?.results ?? []);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unknown error while analyzing PDFs",
      );
      setResults(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">PDF extraction debug</h1>
        <p className="text-sm text-muted-foreground">
          Upload payslip PDFs and inspect extracted text + parser details. This page is for local
          testing only.
        </p>
      </header>

      <section className="space-y-3 rounded-lg border border-border bg-card p-4">
        <Label htmlFor="pdf-debug-files" className="text-sm font-medium">
          Choose PDFs
        </Label>
        <input
          id="pdf-debug-files"
          type="file"
          accept="application/pdf,.pdf"
          multiple
          onChange={onFileChange}
          className="block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-medium"
        />
        <p className="text-xs text-muted-foreground">{selectedLabel}</p>
        <Button onClick={onAnalyze} disabled={loading || files.length === 0}>
          {loading ? "Analyzing..." : "Analyze PDFs"}
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </section>

      {results && (
        <section className="space-y-4">
          {results.map((result, index) => (
            <article
              key={`${index}-${result.filename}`}
              className="space-y-3 rounded-lg border border-border bg-card p-4"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-base font-semibold">{result.filename}</h2>
                <p className="text-xs text-muted-foreground">
                  Status: {result.extractionStatus}
                </p>
              </div>

              {result.extractionStatus === "failed" ? (
                <p className="text-sm text-destructive">{result.errorMessage}</p>
              ) : (
                <>
                  <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                    <p>
                      <span className="font-medium">Display type:</span> {result.displayType}
                    </p>
                    <p>
                      <span className="font-medium">Weekly income:</span>{" "}
                      {result.payslip.weeklyIncome ?? "null"}
                    </p>
                    <p>
                      <span className="font-medium">Confidence:</span>{" "}
                      {result.payslip.confidence}
                    </p>
                    <p>
                      <span className="font-medium">Detected amount:</span>{" "}
                      {result.payslip.detectedIncomeAmount ?? "null"}
                    </p>
                    <p>
                      <span className="font-medium">Detected frequency:</span>{" "}
                      {result.payslip.detectedPayFrequency}
                    </p>
                    <p>
                      <span className="font-medium">Raw text length:</span>{" "}
                      {result.rawTextLength}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm font-medium">Notes</p>
                    {result.payslip.notes.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No notes</p>
                    ) : (
                      <ul className="list-inside list-disc text-sm text-muted-foreground">
                        {result.payslip.notes.map((note, noteIndex) => (
                          <li key={`${noteIndex}-${note}`}>{note}</li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm font-medium">Candidates</p>
                    {result.payslip.candidates.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No candidates matched</p>
                    ) : (
                      <pre className="overflow-x-auto rounded-md bg-secondary/40 p-3 text-xs">
                        {JSON.stringify(result.payslip.candidates, null, 2)}
                      </pre>
                    )}
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm font-medium">Extracted text preview</p>
                    <Textarea
                      value={result.rawTextPreview}
                      readOnly
                      rows={14}
                      className="font-mono text-xs"
                    />
                  </div>
                </>
              )}
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
