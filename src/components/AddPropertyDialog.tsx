import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { useData } from "@/lib/store";
import { DOCUMENT_KEYS, DOCUMENT_LABELS, type DocumentKey, type Property } from "@/lib/types";

const DEFAULT_DOCS: DocumentKey[] = ["id", "proof_of_income", "bank_statements", "rental_history", "references"];

export const AddPropertyDialog = ({ trigger }: { trigger?: React.ReactNode }) => {
  const { addProperty } = useData();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [address, setAddress] = useState("");
  const [suburb, setSuburb] = useState("");
  const [city, setCity] = useState("");
  const [weeklyRent, setWeeklyRent] = useState("");
  const [bedrooms, setBedrooms] = useState("2");
  const [bathrooms, setBathrooms] = useState("1");
  const [parking, setParking] = useState("1");
  const [status, setStatus] = useState<Property["status"]>("active");
  const [imageUrl, setImageUrl] = useState("");
  const [docs, setDocs] = useState<DocumentKey[]>(DEFAULT_DOCS);

  const reset = () => {
    setAddress(""); setSuburb(""); setCity(""); setWeeklyRent("");
    setBedrooms("2"); setBathrooms("1"); setParking("1");
    setStatus("active"); setImageUrl(""); setDocs(DEFAULT_DOCS);
  };

  const toggleDoc = (k: DocumentKey) =>
    setDocs((prev) => (prev.includes(k) ? prev.filter((d) => d !== k) : [...prev, k]));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim() || !suburb.trim() || !city.trim() || !weeklyRent) {
      toast({ title: "Missing details", description: "Address, suburb, city and rent are required." });
      return;
    }
    addProperty({
      address: address.trim(),
      suburb: suburb.trim(),
      city: city.trim(),
      weeklyRent: Number(weeklyRent),
      bedrooms: Number(bedrooms) || 0,
      bathrooms: Number(bathrooms) || 0,
      parking: Number(parking) || 0,
      status,
      imageUrl: imageUrl.trim(),
      requiredDocuments: docs,
    });
    toast({ title: "Property added", description: `${address}, ${suburb}` });
    reset();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="lg"><Plus /> Add property</Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add a property</DialogTitle>
          <DialogDescription>
            Enter listing details and select which documents applicants must submit.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5">
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
              <Input type="number" min={0} value={weeklyRent} onChange={(e) => setWeeklyRent(e.target.value)} placeholder="850" />
            </Field>
            <Field label="Status">
              <Select value={status} onValueChange={(v) => setStatus(v as Property["status"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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

          <Field label="Cover image URL (optional)">
            <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." />
          </Field>

          <div>
            <Label className="text-sm font-semibold">Required documents</Label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Applicants will be scored on completeness against this list.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {DOCUMENT_KEYS.map((k) => (
                <label
                  key={k}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm transition-colors hover:bg-secondary/40"
                >
                  <Checkbox checked={docs.includes(k)} onCheckedChange={() => toggleDoc(k)} />
                  <span>{DOCUMENT_LABELS[k]}</span>
                </label>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">Add property</Button>
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
