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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useData } from "@/lib/store";
import { DOCUMENT_LABELS, type Applicant, type DocumentKey, type Property } from "@/lib/types";

interface Props {
  property: Property;
  trigger?: React.ReactNode;
}

export const AddApplicantDialog = ({ property, trigger }: Props) => {
  const { addApplicant } = useData();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [occupation, setOccupation] = useState("");
  const [weeklyIncome, setWeeklyIncome] = useState("");
  const [submitted, setSubmitted] = useState<DocumentKey[]>([]);
  const [years, setYears] = useState("2");
  const [onTime, setOnTime] = useState("95");
  const [reference, setReference] =
    useState<Applicant["rentalHistory"]["referenceQuality"]>("ok");
  const [historyNotes, setHistoryNotes] = useState("");
  const [agentNotes, setAgentNotes] = useState("");

  const reset = () => {
    setName(""); setEmail(""); setPhone(""); setOccupation(""); setWeeklyIncome("");
    setSubmitted([]); setYears("2"); setOnTime("95"); setReference("ok");
    setHistoryNotes(""); setAgentNotes("");
  };

  const toggleDoc = (k: DocumentKey) =>
    setSubmitted((prev) => (prev.includes(k) ? prev.filter((d) => d !== k) : [...prev, k]));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !weeklyIncome) {
      toast({ title: "Missing details", description: "Name, email and weekly income are required." });
      return;
    }
    addApplicant({
      propertyId: property.id,
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      occupation: occupation.trim(),
      weeklyIncome: Number(weeklyIncome),
      submittedDocuments: submitted,
      rentalHistory: {
        yearsRenting: Number(years) || 0,
        onTimePaymentsPct: Math.min(100, Math.max(0, Number(onTime) || 0)),
        referenceQuality: reference,
        notes: historyNotes.trim() || undefined,
      },
      notes: agentNotes.trim() || undefined,
    });
    toast({ title: "Applicant added", description: `${name} has been scored and ranked.` });
    reset();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="accent" size="sm"><Plus /> Add applicant</Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add an applicant</DialogTitle>
          <DialogDescription>
            For {property.address}, {property.suburb} · ${property.weeklyRent}/wk. Tick which documents they've submitted.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5">
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
            <Field label="Weekly income ($)">
              <Input type="number" min={0} value={weeklyIncome} onChange={(e) => setWeeklyIncome(e.target.value)} placeholder="2200" />
            </Field>
          </div>

          <div>
            <Label className="text-sm font-semibold">Documents submitted</Label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {property.requiredDocuments.length} required for this property.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {property.requiredDocuments.map((k) => (
                <label
                  key={k}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm transition-colors hover:bg-secondary/40"
                >
                  <Checkbox checked={submitted.includes(k)} onCheckedChange={() => toggleDoc(k)} />
                  <span>{DOCUMENT_LABELS[k]}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-sm font-semibold">Rental history</Label>
            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              <Field label="Years renting">
                <Input type="number" min={0} value={years} onChange={(e) => setYears(e.target.value)} />
              </Field>
              <Field label="On-time payments (%)">
                <Input type="number" min={0} max={100} value={onTime} onChange={(e) => setOnTime(e.target.value)} />
              </Field>
              <Field label="Reference quality">
                <Select value={reference} onValueChange={(v) => setReference(v as typeof reference)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="strong">Strong</SelectItem>
                    <SelectItem value="ok">OK</SelectItem>
                    <SelectItem value="weak">Weak</SelectItem>
                    <SelectItem value="none">None</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="mt-3">
              <Field label="History notes (optional)">
                <Textarea rows={2} value={historyNotes} onChange={(e) => setHistoryNotes(e.target.value)} placeholder="Reference from previous agent..." />
              </Field>
            </div>
          </div>

          <Field label="Agent notes (optional)">
            <Textarea rows={2} value={agentNotes} onChange={(e) => setAgentNotes(e.target.value)} placeholder="Wants 12-month lease..." />
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">Add applicant</Button>
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
