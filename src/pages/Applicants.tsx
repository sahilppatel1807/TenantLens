import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { DashboardNav } from "@/components/DashboardNav";
import { ApplicantDrawer } from "@/components/ApplicantDrawer";
import { ScoreRing } from "@/components/ScoreRing";
import { TierBadge } from "@/components/TierBadge";
import { ApplicantStatusBadge } from "@/components/ApplicantStatusActions";
import { Input } from "@/components/ui/input";
import { useData } from "@/lib/store";
import { scoreApplicant } from "@/lib/scoring";

const Applicants = () => {
  const { properties, applicants } = useData();
  const [query, setQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<"all" | "good" | "average" | "bad" | "shortlisted">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const rows = useMemo(() => {
    return applicants
      .map((a) => {
        const property = properties.find((p) => p.id === a.propertyId)!;
        return { a, p: property, s: scoreApplicant(a, property) };
      })
      .filter((r) => {
        if (tierFilter === "all") return true;
        if (tierFilter === "shortlisted") return r.a.status === "shortlisted";
        return r.s.tier === tierFilter;
      })
      .filter((r) => {
        if (!query) return true;
        const q = query.toLowerCase();
        return (
          r.a.name.toLowerCase().includes(q) ||
          r.a.email.toLowerCase().includes(q) ||
          r.p.address.toLowerCase().includes(q) ||
          r.p.suburb.toLowerCase().includes(q)
        );
      })
      .sort((x, y) => y.s.total - x.s.total);
  }, [query, tierFilter]);

  const selected = rows.find((r) => r.a.id === selectedId);

  return (
    <div className="min-h-screen bg-secondary/30">
      <DashboardNav />
      <main className="container py-8 md:py-10">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">All applicants</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every applicant across your portfolio, ranked by TenantLens score.
          </p>
        </div>

        <section className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, email or property"
              className="pl-9"
            />
          </div>
          <div className="inline-flex rounded-lg border border-border bg-card p-1">
            {(["all", "shortlisted", "good", "average", "bad"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTierFilter(t)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                  tierFilter === t ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </section>

        <section className="mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
          <div className="hidden grid-cols-[64px_1.5fr_1.5fr_120px_120px] gap-4 border-b border-border bg-secondary/40 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:grid">
            <span>Score</span>
            <span>Applicant</span>
            <span>Property</span>
            <span>Income</span>
            <span>Tier</span>
          </div>
          {rows.map(({ a, p, s }) => (
            <button
              key={a.id}
              onClick={() => setSelectedId(a.id)}
              className="grid w-full grid-cols-[64px_1fr] items-center gap-4 border-b border-border px-4 py-4 text-left transition-colors last:border-b-0 hover:bg-secondary/40 md:grid-cols-[64px_1.5fr_1.5fr_120px_120px]"
            >
              <ScoreRing score={s.total} tier={s.tier} size={48} />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate font-semibold text-foreground">{a.name}</p>
                  <ApplicantStatusBadge status={a.status} />
                </div>
                <p className="truncate text-sm text-muted-foreground">{a.occupation}</p>
              </div>
              <div className="hidden min-w-0 md:block">
                <p className="truncate text-sm font-medium text-foreground">{p.address}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {p.suburb} · ${p.weeklyRent}/wk
                </p>
              </div>
              <div className="hidden md:block">
                <p className="text-sm font-semibold">${a.weeklyIncome}/wk</p>
                <p className="text-xs text-muted-foreground">{s.rentToIncomeRatio.toFixed(1)}x rent</p>
              </div>
              <div className="hidden md:block">
                <TierBadge tier={s.tier} />
              </div>
            </button>
          ))}
          {rows.length === 0 && (
            <div className="p-12 text-center text-sm text-muted-foreground">No applicants match your filters.</div>
          )}
        </section>

        <p className="mt-4 text-xs text-muted-foreground">
          Tip: open a property from{" "}
          <Link to="/dashboard" className="font-medium text-foreground hover:underline">
            Properties
          </Link>{" "}
          to compare applicants side-by-side.
        </p>
      </main>

      <ApplicantDrawer
        applicant={selected?.a ?? null}
        property={selected?.p ?? null}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
};

export default Applicants;
