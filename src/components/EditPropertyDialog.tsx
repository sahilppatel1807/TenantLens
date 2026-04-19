import { useEffect, useState } from "react";
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
import { PropertyFormFields } from "@/components/PropertyFormFields";
import { useToast } from "@/hooks/use-toast";
import { useData } from "@/lib/store";
import { type DocumentKey, type Property } from "@/lib/types";

export function EditPropertyDialog({
  property,
  trigger,
}: {
  property: Property;
  trigger: React.ReactNode;
}) {
  const { updateProperty } = useData();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const [address, setAddress] = useState(property.address);
  const [suburb, setSuburb] = useState(property.suburb);
  const [city, setCity] = useState(property.city);
  const [weeklyRent, setWeeklyRent] = useState(String(property.weeklyRent));
  const [bedrooms, setBedrooms] = useState(String(property.bedrooms));
  const [bathrooms, setBathrooms] = useState(String(property.bathrooms));
  const [parking, setParking] = useState(String(property.parking));
  const [status, setStatus] = useState<Property["status"]>(property.status);
  const [imageUrl, setImageUrl] = useState(property.imageUrl);
  const [coverUploading, setCoverUploading] = useState(false);
  const [docs, setDocs] = useState<DocumentKey[]>(property.requiredDocuments);

  useEffect(() => {
    if (!open) return;
    setAddress(property.address);
    setSuburb(property.suburb);
    setCity(property.city);
    setWeeklyRent(String(property.weeklyRent));
    setBedrooms(String(property.bedrooms));
    setBathrooms(String(property.bathrooms));
    setParking(String(property.parking));
    setStatus(property.status);
    setImageUrl(property.imageUrl);
    setDocs([...property.requiredDocuments]);
  }, [open, property]);

  const toggleDoc = (k: DocumentKey) =>
    setDocs((prev) => (prev.includes(k) ? prev.filter((d) => d !== k) : [...prev, k]));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim() || !suburb.trim() || !city.trim() || !weeklyRent) {
      toast({ title: "Missing details", description: "Address, suburb, city and rent are required." });
      return;
    }
    try {
      await updateProperty(property.id, {
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
      toast({ title: "Property updated", description: `${address.trim()}, ${suburb.trim()}` });
      setOpen(false);
    } catch (err) {
      toast({
        title: "Could not update property",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit property</DialogTitle>
          <DialogDescription>Update listing details and required documents.</DialogDescription>
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
            propertyIdForCoverUpload={property.id}
            onCoverUploadStateChange={setCoverUploading}
          />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={coverUploading}>
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
