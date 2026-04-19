import { useState } from "react";
import { Plus } from "lucide-react";
import { UpgradeRequiredError } from "@/lib/billing/upgrade-required-error";
import { PropertyFormFields } from "@/components/PropertyFormFields";
import { Button } from "@/components/ui/button";
import { ToastAction } from "@/components/ui/toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  DEFAULT_PROPERTY_REQUIRED_DOCUMENTS,
  togglePropertyRequiredDocumentCategory,
  type DocumentCategory,
} from "@/lib/document-categories";
import { useData } from "@/lib/store";
import { startSubscriptionCheckout } from "@/lib/stripe/start-subscription-checkout";
import { type DocumentKey, type Property } from "@/lib/types";

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
  const [docs, setDocs] = useState<DocumentKey[]>([...DEFAULT_PROPERTY_REQUIRED_DOCUMENTS]);
  const [coverUploading, setCoverUploading] = useState(false);

  const reset = () => {
    setAddress(""); setSuburb(""); setCity(""); setWeeklyRent("");
    setBedrooms("2"); setBathrooms("1"); setParking("1");
    setStatus("active"); setImageUrl(""); setDocs([...DEFAULT_PROPERTY_REQUIRED_DOCUMENTS]);
  };

  const toggleRequiredDocCategory = (category: DocumentCategory) =>
    setDocs((prev) => togglePropertyRequiredDocumentCategory(prev, category));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim() || !suburb.trim() || !city.trim() || !weeklyRent) {
      toast({ title: "Missing details", description: "Address, suburb, city and rent are required." });
      return;
    }
    try {
      await addProperty({
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
    } catch (err) {
      if (err instanceof UpgradeRequiredError) {
        toast({
          title: "Subscription required",
          description: `${err.message} After you subscribe, add this listing again.`,
          action: (
            <ToastAction altText="Subscribe with Stripe" onClick={() => void startSubscriptionCheckout()}>
              Subscribe
            </ToastAction>
          ),
        });
        return;
      }
      toast({
        title: "Could not add property",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
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
            toggleRequiredDocCategory={toggleRequiredDocCategory}
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
