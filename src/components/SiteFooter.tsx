import { Logo } from "./Logo";

export const SiteFooter = () => (
  <footer className="border-t border-border/60 bg-background">
    <div className="container py-12">
      <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-sm text-sm text-muted-foreground">
            Decision-support for property managers. Faster reviews, clearer comparisons, less chasing.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} TenantLens. Built for real estate teams.
        </p>
      </div>
    </div>
  </footer>
);
