import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowUpDown, Bath, BedDouble, Car, GitCompare, MapPin, Users } from "lucide-react";
import { DashboardNav } from "@/components/DashboardNav";
import { ApplicantRow } from "@/components/ApplicantRow";
import { ApplicantDrawer } from "@/components/ApplicantDrawer";
import { CompareDialog } from "@/components/CompareDialog";
import { AddApplicantDialog } from "@/components/AddApplicantDialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useData } from "@/lib/store";
import { scoreApplicant, tierStyles } from "@/lib/scoring";

type TierFilter = "all" | "good" | "average" | "bad";
type StatusFilter = "all" | "shortlisted" | "rejected" | "new";

const PropertyDetail = () => {
  const { propertyId } = useParams<{ propertyId: string }>();
  const { properties, applicants, setApplicantStatus } = useData();
  const property = properties.find((p) => p.id === propertyId);
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<"score" | "newest">("score");
  const [compareOpen, setCompareOpen] = useState(false);

  const propertyApplicants = useMemo(
    () => applicants.filter((a) => a.propertyId === propertyId),
    [applicants, propertyId],
  );

  const ranked = useMemo(() => {
    if (!property) return [];
    const list = propertyApplicants.map((a) => ({ a, s: scoreApplicant(a, property) }));
    if (sort === "score") list.sort((x, y) => y.s.total - x.s.total);
    else list.sort((x, y) => +new Date(y.a.appliedAt) - +new Date(x.a.appliedAt));
    return list
      .filter((x) => (tierFilter === "all" ? true : x.s.tier === tierFilter))
      .filter((x) => (statusFilter === "all" ? true : x.a.status === statusFilter));
  }, [propertyApplicants, property, sort, tierFilter, statusFilter]);

  const tierCounts = useMemo(() => {
    if (!property) return { good: 0, average: 0, bad: 0 };
    return propertyApplicants.reduce(
      (acc, a) => {
        const t = scoreApplicant(a, property).tier;
        acc[t] += 1;
        return acc;
      },
      { good: 0, average: 0, bad: 0 } as Record<"good" | "average" | "bad", number>,
    );
  }, [propertyApplicants, property]);

  const shortlistedCount = propertyApplicants.filter((a) => a.status === "shortlisted").length;
  const rejectedCount = propertyApplicants.filter((a) => a.status === "rejected").length;

  if (!property) {
    return (
      <div className="min-h-screen bg-secondary/30">
        <DashboardNav />
        <main className="container py-16 text-center">
          <h1 className="text-xl font-semibold">Property not found</h1>
          <Button asChild variant="outline" className="mt-4">
            <Link to="/dashboard"><ArrowLeft /> Back to properties</Link>
          </Button>
        </main>
      </div>
    );
  }

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 4) next.add(id);
      else
        toast({
          title: "Select up to 4",
          description: "You can compare up to four applicants at a time.",
        });
      return next;
    });
  };

  const selectedApplicants = propertyApplicants.filter((a) => selected.has(a.id));
  const activeApplicant = propertyApplicants.find((a) => a.id === selectedId) ?? null;

  return (
    <div className="min-h-screen bg-secondary/30">
      <DashboardNav />

      <main className="container py-8">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Properties
        </Link>

        {/* Hero */}
        <section className="mt-4 overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
          <div className="grid gap-0 md:grid-cols-[1.2fr_1fr]">
            <div className="aspect-[16/10] md:aspect-auto">
              <img src={property.imageUrl} alt={property.address} className="h-full w-full object-cover" />
            </div>
            <div className="flex flex-col justify-between p-6 md:p-8">
              <div>
                <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{property.address}</h1>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" /> {property.suburb}, {property.city}
                </p>
                <div className="mt-5 flex flex-wrap items-center gap-4 text-sm">
                  <Spec icon={<BedDouble className="h-4 w-4" />} label={`${property.bedrooms} bed`} />
                  <Spec icon={<Bath className="h-4 w-4" />} label={`${property.bathrooms} bath`} />
                  <Spec icon={<Car className="h-4 w-4" />} label={`${property.parking} parking`} />
                </div>
                <div className="mt-5">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Weekly rent</p>
                  <p className="text-2xl font-bold text-foreground">${property.weeklyRent}</p>
                </div>
              </div>
              <div className="mt-6 grid grid-cols-3 gap-2">
                <TierStat label="Good" value={tierCounts.good} tier="good" />
                <TierStat label="Average" value={tierCounts.average} tier="average" />
                <TierStat label="Bad" value={tierCounts.bad} tier="bad" />
              </div>
            </div>
          </div>
        </section>

        {/* Applicants */}
        <section className="mt-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold tracking-tight">Applicants</h2>
              <p className="text-sm text-muted-foreground">
                {propertyApplicants.length} total · {shortlistedCount} shortlisted · {rejectedCount} rejected
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSort((s) => (s === "score" ? "newest" : "score"))}
              >
                <ArrowUpDown /> Sort: {sort === "score" ? "Score" : "Newest"}
              </Button>
              <Button
                size="sm"
                disabled={selected.size < 2}
                onClick={() => setCompareOpen(true)}
              >
                <GitCompare /> Compare ({selected.size})
              </Button>
              <AddApplicantDialog property={property} />
            </div>
          </div>

          {/* Filters */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <FilterGroup
              label="Tier"
              value={tierFilter}
              onChange={(v) => setTierFilter(v as TierFilter)}
              options={["all", "good", "average", "bad"]}
            />
            <FilterGroup
              label="Status"
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as StatusFilter)}
              options={["all", "shortlisted", "new", "rejected"]}
            />
          </div>

          {ranked.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-border bg-card/60 p-12 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <Users className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-base font-semibold">No applicants yet</h3>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                Add applicants to start scoring and ranking them automatically.
              </p>
            </div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
              {ranked.map(({ a, s }, idx) => (
                <ApplicantRow
                  key={a.id}
                  applicant={a}
                  score={s}
                  rank={idx + 1}
                  selected={selected.has(a.id)}
                  onToggleSelect={toggleSelect}
                  onClick={(id) => setSelectedId(id)}
                  onStatusChange={setApplicantStatus}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      <ApplicantDrawer
        applicant={activeApplicant}
        property={property}
        onClose={() => setSelectedId(null)}
      />
      <CompareDialog
        open={compareOpen}
        onOpenChange={setCompareOpen}
        applicants={selectedApplicants}
        property={property}
      />
    </div>
  );
};

const FilterGroup = ({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
}) => (
  <div className="inline-flex items-center gap-2">
    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
    <div className="inline-flex rounded-lg border border-border bg-card p-1">
      {options.map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
            value === t ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  </div>
);

const Spec = ({ icon, label }: { icon: React.ReactNode; label: string }) => (
  <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-foreground">
    {icon} {label}
  </span>
);

const TierStat = ({ label, value, tier }: { label: string; value: number; tier: "good" | "average" | "bad" }) => (
  <div className={`rounded-xl border p-3 text-center ${tierStyles[tier].chip}`}>
    <p className="text-xs font-semibold">{label}</p>
    <p className="mt-1 text-xl font-bold">{value}</p>
  </div>
);

export default PropertyDetail;
