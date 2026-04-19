"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { uploadPropertyCoverImage } from "@/lib/supabase/property-cover-upload";
import {
  propertyRequiresDocumentCategory,
  type DocumentCategory,
} from "@/lib/document-categories";
import { type DocumentKey, type Property } from "@/lib/types";

const REQUIRED_DOC_CATEGORY_UI: {
  category: DocumentCategory;
  title: string;
  hint?: string;
}[] = [
  {
    category: "identity",
    title: "ID",
    hint: "Passport, driver's licence, or other photo ID.",
  },
  { category: "income", title: "Proof of income" },
  { category: "bank", title: "Bank statements" },
  {
    category: "rental",
    title: "Rental history and references",
    hint: "Reference letter or rental history.",
  },
];

export function PropertyFormFields({
  address,
  setAddress,
  suburb,
  setSuburb,
  city,
  setCity,
  weeklyRent,
  setWeeklyRent,
  bedrooms,
  setBedrooms,
  bathrooms,
  setBathrooms,
  parking,
  setParking,
  status,
  setStatus,
  imageUrl,
  setImageUrl,
  docs,
  toggleRequiredDocCategory,
  propertyIdForCoverUpload,
  onCoverUploadStateChange,
}: {
  address: string;
  setAddress: (v: string) => void;
  suburb: string;
  setSuburb: (v: string) => void;
  city: string;
  setCity: (v: string) => void;
  weeklyRent: string;
  setWeeklyRent: (v: string) => void;
  bedrooms: string;
  setBedrooms: (v: string) => void;
  bathrooms: string;
  setBathrooms: (v: string) => void;
  parking: string;
  setParking: (v: string) => void;
  status: Property["status"];
  setStatus: (v: Property["status"]) => void;
  imageUrl: string;
  setImageUrl: (v: string) => void;
  docs: DocumentKey[];
  toggleRequiredDocCategory: (category: DocumentCategory) => void;
  /** When editing, uploads use `{userId}/{propertyId}/…` paths. Omit on add. */
  propertyIdForCoverUpload?: string;
  /** Set while a file upload is in progress so the parent can disable form submit. */
  onCoverUploadStateChange?: (busy: boolean) => void;
}) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [coverUploading, setCoverUploading] = useState(false);

  const setBusy = (busy: boolean) => {
    setCoverUploading(busy);
    onCoverUploadStateChange?.(busy);
  };

  const onPickCoverFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      toast({ title: "Upload unavailable", description: "Supabase is not configured.", variant: "destructive" });
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast({ title: "Sign in required", description: "You must be signed in to upload images.", variant: "destructive" });
      return;
    }

    setBusy(true);
    try {
      const url = await uploadPropertyCoverImage(supabase, {
        userId: user.id,
        file,
        propertyId: propertyIdForCoverUpload,
      });
      setImageUrl(url);
      toast({ title: "Image uploaded", description: "Cover image URL was set from your file." });
    } catch (err) {
      toast({
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Street address" className="sm:col-span-2">
          <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="12/48 Bondi Road" />
        </Field>
        <Field label="Suburb">
          <Input value={suburb} onChange={(e) => setSuburb(e.target.value)} placeholder="Bondi" />
        </Field>
        <Field label="City / State">
          <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Sydney NSW 2026" />
        </Field>
        <Field label="Weekly rent ($)">
          <Input
            type="number"
            min={0}
            value={weeklyRent}
            onChange={(e) => setWeeklyRent(e.target.value)}
            placeholder="850"
          />
        </Field>
        <Field label="Status">
          <Select value={status} onValueChange={(v) => setStatus(v as Property["status"])}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="leased">Leased</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Bedrooms">
          <Input type="number" min={0} value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} />
        </Field>
        <Field label="Bathrooms">
          <Input type="number" min={0} value={bathrooms} onChange={(e) => setBathrooms(e.target.value)} />
        </Field>
        <Field label="Parking">
          <Input type="number" min={0} value={parking} onChange={(e) => setParking(e.target.value)} />
        </Field>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground">Cover image (optional)</Label>
        <p className="text-xs text-muted-foreground">Paste an image URL or upload a file (max 5 MB).</p>
        <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." />
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(ev) => void onPickCoverFile(ev)}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={coverUploading}
          onClick={() => fileRef.current?.click()}
          className="gap-1.5"
        >
          <Upload className="h-4 w-4" />
          {coverUploading ? "Uploading…" : "Upload image"}
        </Button>
        {imageUrl.trim() ? (
          <img
            src={imageUrl.trim()}
            alt="Cover preview"
            className="mt-2 h-24 max-w-xs rounded-md border border-border object-cover"
          />
        ) : null}
      </div>

      <div>
        <Label className="text-sm font-semibold">Required documents</Label>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Applicants will be scored on completeness against this list.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {REQUIRED_DOC_CATEGORY_UI.map(({ category, title, hint }) => (
            <label
              key={category}
              className="flex cursor-pointer flex-col gap-1 rounded-lg border border-border bg-card px-3 py-2 text-sm transition-colors hover:bg-secondary/40"
            >
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={propertyRequiresDocumentCategory(docs, category)}
                  onCheckedChange={() => toggleRequiredDocCategory(category)}
                />
                <span className="font-medium">{title}</span>
              </div>
              {hint ? <p className="pl-6 text-xs text-muted-foreground">{hint}</p> : null}
            </label>
          ))}
        </div>
      </div>
    </>
  );
}

const Field = ({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) => (
  <div className={`space-y-1.5 ${className}`}>
    <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
    {children}
  </div>
);
