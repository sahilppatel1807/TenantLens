import { useId } from "react";
import { Label } from "@/components/ui/label";

interface PdfIntakeFilePickerProps {
  selectedPdfFiles: File[];
  setSelectedPdfFiles: (files: File[]) => void;
  label?: string;
}

export function PdfIntakeFilePicker({ selectedPdfFiles, setSelectedPdfFiles, label = "PDFs" }: PdfIntakeFilePickerProps) {
  const fileInputId = useId();
  return (
    <div>
      <Label className="text-sm font-semibold">{label}</Label>
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
  );
}
