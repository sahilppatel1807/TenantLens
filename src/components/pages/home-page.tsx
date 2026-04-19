import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  FileSearch,
  Gauge,
  ListChecks,
  ScanSearch,
  Scale,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import heroImage from "@/assets/hero-illustration.jpg";

const features = [
  {
    icon: ListChecks,
    title: "Document completeness",
    body: "Define a checklist per property. See instantly what's missing — passport, payslips, references, rental history.",
  },
  {
    icon: Gauge,
    title: "Transparent scoring",
    body: "A simple 100-point score per applicant. No black box — every point is explainable to your landlords.",
  },
  {
    icon: Scale,
    title: "Side-by-side compare",
    body: "Rank applicants by score and compare income, history and completeness in one view.",
  },
  {
    icon: FileSearch,
    title: "Quick review",
    body: "Open one applicant and see everything: documents, missing items, summary. Decide in minutes, not hours.",
  },
  {
    icon: ScanSearch,
    title: "Income vs rent",
    body: "Income is evaluated relative to weekly rent — strong (3×), medium (2–3×), low (<2×). Sensible by default.",
  },
  {
    icon: Sparkles,
    title: "Built for agencies",
    body: "Familiar property cards, clean dashboard, no learning curve. Your team is productive on day one.",
  },
];

const scoreBreakdown = [
  { label: "Document completeness", points: 50, color: "bg-primary" },
  { label: "Income vs rent", points: 30, color: "bg-accent" },
  { label: "Rental history", points: 20, color: "bg-tier-good" },
];

const tiers = [
  { tier: "Good", range: "75 – 100", desc: "Complete, well-documented, strong income.", classes: "bg-tier-good-soft text-tier-good border-tier-good/20" },
  { tier: "Average", range: "50 – 74", desc: "Some gaps or moderate income coverage.", classes: "bg-tier-average-soft text-tier-average border-tier-average/30" },
  { tier: "Bad", range: "0 – 49", desc: "Significant gaps or insufficient income.", classes: "bg-tier-bad-soft text-tier-bad border-tier-bad/20" },
];

export function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main>
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 -z-10 gradient-subtle" />
          <div className="absolute right-0 top-0 -z-10 h-[600px] w-[600px] rounded-full bg-accent/10 blur-3xl" />
          <div className="container grid gap-12 py-20 lg:grid-cols-2 lg:items-center lg:py-28">
            <div className="animate-fade-in-up space-y-6">
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                Built for real estate agencies
              </span>
              <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground md:text-5xl lg:text-6xl">
                Review rental applicants in <span className="text-accent">minutes</span>, not hours.
              </h1>
              <p className="max-w-xl text-balance text-lg text-muted-foreground">
                TenantLens checks documents, scores applicants out of 100, and lets you compare them side-by-side.
                A clear, explainable decision-support tool for property managers.
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <Button asChild variant="hero" size="xl">
                  <Link href="/register">
                    Start free <ArrowRight />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="xl">
                  <a href="#scoring">See how scoring works</a>
                </Button>
              </div>
              <ul className="flex flex-wrap gap-x-6 gap-y-2 pt-4 text-sm text-muted-foreground">
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-accent" /> Try 3 listings free</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-accent" /> Review applicants in minutes</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-accent" /> Only pay for active properties</li>
              </ul>
            </div>
            <div className="relative animate-fade-in">
              <div className="absolute -inset-4 rounded-3xl bg-gradient-to-tr from-accent/20 to-primary/20 blur-2xl" />
              <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-float">
                <Image
                  src={heroImage}
                  alt="TenantLens applicant review dashboard illustration"
                  width={1408}
                  height={1024}
                  className="h-auto w-full"
                  priority
                />
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="border-t border-border/60 py-20 lg:py-28">
          <div className="container">
            <div className="mx-auto max-w-2xl text-center">
              <span className="text-sm font-semibold uppercase tracking-wider text-accent">Features</span>
              <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight md:text-4xl">
                Everything you need to triage applicants fast
              </h2>
              <p className="mt-4 text-muted-foreground">
                No bloat. No AI hype. Just the tools your team actually uses to make better calls.
              </p>
            </div>
            <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {features.map((f) => (
                <article
                  key={f.title}
                  className="group rounded-xl border border-border bg-card p-6 shadow-soft transition-all hover:-translate-y-1 hover:shadow-elegant"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent-soft text-accent">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="scoring" className="border-t border-border/60 bg-secondary/40 py-20 lg:py-28">
          <div className="container grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <span className="text-sm font-semibold uppercase tracking-wider text-accent">Scoring</span>
              <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight md:text-4xl">
                A 100-point score you can explain to any landlord
              </h2>
              <p className="mt-4 text-muted-foreground">
                We deliberately keep scoring simple. Three factors, clear weights, no surprises.
              </p>
              <div className="mt-8 space-y-4">
                {scoreBreakdown.map((s) => (
                  <div key={s.label} className="rounded-lg border border-border bg-card p-4 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{s.label}</span>
                      <span className="text-sm font-semibold text-muted-foreground">{s.points} pts</span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
                      <div className={`h-full ${s.color}`} style={{ width: `${s.points}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid gap-4">
              {tiers.map((t) => (
                <div key={t.tier} className={`rounded-xl border p-6 ${t.classes}`}>
                  <div className="flex items-baseline justify-between">
                    <h3 className="text-2xl font-bold">{t.tier}</h3>
                    <span className="text-sm font-semibold opacity-80">{t.range}</span>
                  </div>
                  <p className="mt-2 text-sm opacity-90">{t.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="workflow" className="border-t border-border/60 py-20 lg:py-28">
          <div className="container">
            <div className="mx-auto max-w-2xl text-center">
              <span className="text-sm font-semibold uppercase tracking-wider text-accent">Workflow</span>
              <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight md:text-4xl">
                From inbox chaos to a ranked shortlist
              </h2>
            </div>
            <ol className="mt-14 grid gap-6 md:grid-cols-3">
              {[
                { n: "01", t: "Add a property", d: "Address, weekly rent, document checklist. 30 seconds." },
                { n: "02", t: "Add applicants", d: "Upload their documents and basic details as they come in." },
                { n: "03", t: "Review & decide", d: "See ranked applicants, compare side-by-side, shortlist the best." },
              ].map((s) => (
                <li key={s.n} className="rounded-xl border border-border bg-card p-6 shadow-soft">
                  <span className="text-sm font-bold text-accent">{s.n}</span>
                  <h3 className="mt-3 text-lg font-semibold">{s.t}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{s.d}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="pricing" className="border-t border-border/60 py-20 lg:py-28">
          <div className="container">
            <div className="relative mx-auto max-w-4xl overflow-hidden rounded-2xl gradient-hero shadow-float">
              <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent/25 blur-3xl" />
              <div className="absolute -bottom-32 -left-24 h-64 w-64 rounded-full bg-primary-foreground/10 blur-3xl" />
              <div className="relative px-6 py-10 md:px-10 md:py-12">
                <div className="mx-auto max-w-2xl text-center">
                  <span className="text-sm font-semibold uppercase tracking-wider text-primary-foreground/70">
                    Pricing
                  </span>
                  <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-primary-foreground md:text-4xl">
                    Simple pricing for growing agencies
                  </h2>
                  <p className="mt-3 text-pretty text-base text-primary-foreground/85">
                    Start free with 3 listings. Only pay when you grow.
                  </p>
                </div>
                <div className="mx-auto mt-10 grid max-w-3xl gap-6 md:mt-12 md:grid-cols-2 md:items-stretch">
                  <article className="flex h-full flex-col rounded-2xl border border-border/80 bg-card p-6 text-left shadow-soft md:p-8">
                    <span className="inline-flex w-fit rounded-full border border-border bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground">
                      Free
                    </span>
                    <div className="mt-5 flex flex-wrap items-end gap-x-2 gap-y-1">
                      <span className="text-4xl font-extrabold tracking-tight text-foreground">Free</span>
                      <span className="pb-1 text-sm font-medium text-muted-foreground">3 active listings included</span>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                      Get started quickly and review applicants in minutes.
                    </p>
                    <ul className="mt-6 flex flex-1 flex-col gap-3 text-sm text-muted-foreground">
                      <li className="flex items-start gap-2.5">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
                        <span>3 active listings</span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
                        <span>Unlimited applicants</span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
                        <span>Full scoring & document review</span>
                      </li>
                    </ul>
                    <div className="mt-8">
                      <Button asChild variant="secondary" size="lg" className="w-full">
                        <Link href="/register">
                          Start free <ArrowRight />
                        </Link>
                      </Button>
                    </div>
                  </article>
                  <article className="flex h-full flex-col rounded-2xl border border-accent/50 bg-card p-6 text-left shadow-md ring-1 ring-accent/25 md:p-8">
                    <span className="inline-flex w-fit rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground shadow-sm">
                      Most popular
                    </span>
                    <div className="mt-5 flex flex-wrap items-end gap-x-2 gap-y-1">
                      <span className="text-4xl font-extrabold tracking-tight text-accent">$15</span>
                      <span className="pb-1 text-sm font-medium text-muted-foreground">per active property / month</span>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                      Pay as you grow. Only pay for listings that are active.
                    </p>
                    <ul className="mt-6 flex flex-1 flex-col gap-3 text-sm text-muted-foreground">
                      <li className="flex items-start gap-2.5">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
                        <span>Unlimited applicants</span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
                        <span>Pay only for active listings</span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
                        <span>Cancel anytime</span>
                      </li>
                    </ul>
                    <div className="mt-8">
                      <Button asChild variant="hero" size="lg" className="w-full">
                        <Link href="/register?plan=paid">
                          Get started <ArrowRight />
                        </Link>
                      </Button>
                    </div>
                  </article>
                </div>
                <p className="mx-auto mt-8 max-w-3xl text-center text-xs text-primary-foreground/70">
                  No base fee. No surprises.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
