import { Building2, Home, Plus, Search, TrendingUp, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { DashboardNav } from "@/components/DashboardNav";
import { PropertyCard } from "@/components/PropertyCard";
import { AddPropertyDialog } from "@/components/AddPropertyDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useData } from "@/lib/store";
import { scoreApplicant } from "@/lib/scoring";

const Dashboard = () => {
  const { properties, applicants } = useData();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "leased">("all");

  const stats = useMemo(() => {
    const goodApplicants = applicants.filter((a) => {
      const property = properties.find((p) => p.id === a.propertyId);
      if (!property) return false;
      return scoreApplicant(a, property).tier === "good";
    }).length;
    return {
      properties: properties.length,
      active: properties.filter((p) => p.status === "active").length,
      applicants: applicants.length,
      good: goodApplicants,
    };
  }, [properties, applicants]);

  const filtered = useMemo(() => {
    return properties.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (!query) return true;
      const q = query.toLowerCase();
      return (
        p.address.toLowerCase().includes(q) ||
        p.suburb.toLowerCase().includes(q) ||
        p.city.toLowerCase().includes(q)
      );
    });
  }, [query, statusFilter, properties]);

  return (
    <div className="min-h-screen bg-secondary/30">
      <DashboardNav />

      <main className="container py-8 md:py-10">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Properties</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage your listings and review applicants ranked by TenantLens score.
            </p>
          </div>
          <AddPropertyDialog />
        </div>

        {/* Stat cards */}
        <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={<Home className="h-4 w-4" />} label="Total properties" value={stats.properties} />
          <StatCard icon={<Building2 className="h-4 w-4" />} label="Active listings" value={stats.active} />
          <StatCard icon={<Users className="h-4 w-4" />} label="Applicants" value={stats.applicants} />
          <StatCard
            icon={<TrendingUp className="h-4 w-4" />}
            label="Strong candidates"
            value={stats.good}
            accent
          />
        </section>

        {/* Filters */}
        <section className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search address, suburb or city"
              className="pl-9"
            />
          </div>
          <div className="inline-flex rounded-lg border border-border bg-card p-1">
            {(["all", "active", "leased"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                  statusFilter === s
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </section>

        {/* Grid */}
        {filtered.length > 0 ? (
          <section className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => {
              const apps = applicants.filter((a) => a.propertyId === p.id);
              const top = apps
                .map((a) => scoreApplicant(a, p).total)
                .sort((a, b) => b - a)[0];
              const shortlistedCount = apps.filter((a) => a.status === "shortlisted").length;
              return (
                <PropertyCard
                  key={p.id}
                  property={p}
                  applicantCount={apps.length}
                  topScore={top}
                  shortlistedCount={shortlistedCount}
                />
              );
            })}
          </section>
        ) : (
          <section className="mt-10 rounded-2xl border border-dashed border-border bg-card/60 p-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <Building2 className="h-7 w-7" />
            </div>
            <h2 className="mt-5 text-lg font-semibold">No properties found</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Try adjusting your filters, or add a new property to get started.
            </p>
            <div className="mt-6 inline-block">
              <AddPropertyDialog
                trigger={<Button><Plus /> Add property</Button>}
              />
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

const StatCard = ({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  accent?: boolean;
}) => (
  <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
      <span
        className={`flex h-7 w-7 items-center justify-center rounded-md ${
          accent ? "bg-accent-soft text-accent" : "bg-secondary text-foreground"
        }`}
      >
        {icon}
      </span>
      {label}
    </div>
    <p className="mt-3 text-2xl font-bold tracking-tight text-foreground">{value}</p>
  </div>
);

export default Dashboard;
