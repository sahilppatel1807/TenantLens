import { useState } from "react";
import { Plus } from "lucide-react";
import { PropertyFormFields } from "@/components/PropertyFormFields";
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
  const [docs, setDocs] = useState<DocumentKey[]>(["id", "proof_of_income", "bank_statements", "rental_history", "references"]);
  const [coverUploading, setCoverUploading] = useState(false);

  const reset = () => {
    setAddress(""); setSuburb(""); setCity(""); setWeeklyRent("");
    setBedrooms("2"); setBathrooms("1"); setParking("1");
    setStatus("active"); setImageUrl(""); setDocs(["id", "proof_of_income", "bank_statements", "rental_history", "references"]);
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
          <PropertyFormFields
            address={address}
            setAddress={setAddress}
            suburb={suburb}
            setSuburb={setSuburb}
            city={city}
            setCity={setCity}
            weeklyRent={weeklyRent}
            setWeeklyRent={setWeeklyRent}
            bedrooms={bedrooms}
            setBedrooms={setBedrooms}
            bathrooms={bathrooms}
            setBathrooms={setBathrooms}
            parking={parking}
            setParking={setParking}
            status={status}
            setStatus={setStatus}
            imageUrl={imageUrl}
            setImageUrl={setImageUrl}
            docs={docs}
            toggleDoc={toggleDoc}
            onCoverUploadStateChange={setCoverUploading}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={coverUploading}>Add property</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
