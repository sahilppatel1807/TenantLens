import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UpgradeRequiredError } from "@/lib/billing/upgrade-required-error";
import { Button } from "@/components/ui/button";
import { ToastAction } from "@/components/ui/toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter as AlertDialogButtons,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
import { startSubscriptionCheckout } from "@/lib/stripe/start-subscription-checkout";
import {
  togglePropertyRequiredDocumentCategory,
  type DocumentCategory,
} from "@/lib/document-categories";
import { type DocumentKey, type Property } from "@/lib/types";

export function EditPropertyDialog({
  property,
  trigger,
}: {
  property: Property;
  trigger: React.ReactNode;
}) {
  const { updateProperty, deleteProperty } = useData();
  const { toast } = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  const toggleRequiredDocCategory = (category: DocumentCategory) =>
    setDocs((prev) => togglePropertyRequiredDocumentCategory(prev, category));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim() || !suburb.trim() || !city.trim() || !weeklyRent) {
      toast({ title: "Missing details", description: "Address, suburb, city and rent are required." });
      return;
    }
    try {
      setSaving(true);
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
      if (err instanceof UpgradeRequiredError) {
        toast({
          title: "Subscription required",
          description: `${err.message} After you subscribe, save this change again.`,
          action: (
            <ToastAction altText="Subscribe with Stripe" onClick={() => void startSubscriptionCheckout()}>
              Subscribe
            </ToastAction>
          ),
        });
        return;
      }
      toast({
        title: "Could not update property",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const deleteCurrentProperty = async () => {
    try {
      setDeleting(true);
      await deleteProperty(property.id);
      toast({ title: "Property deleted", description: `${property.address}, ${property.suburb} was removed.` });
      setOpen(false);
      router.push("/dashboard");
    } catch (err) {
      toast({
        title: "Could not delete property",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
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
            toggleRequiredDocCategory={toggleRequiredDocCategory}
            propertyIdForCoverUpload={property.id}
            onCoverUploadStateChange={setCoverUploading}
          />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving || deleting}>
              Cancel
            </Button>
            <div className="flex items-center gap-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="destructive" disabled={saving || deleting || coverUploading}>
                    {deleting ? "Deleting..." : "Delete property"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this property?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This permanently deletes the property and all associated applicants. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogButtons>
                    <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={deleteCurrentProperty}
                      disabled={deleting}
                    >
                      {deleting ? "Deleting..." : "Delete property"}
                    </AlertDialogAction>
                  </AlertDialogButtons>
                </AlertDialogContent>
              </AlertDialog>
              <Button type="submit" disabled={coverUploading || saving || deleting}>
                {saving ? "Saving..." : "Save changes"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
