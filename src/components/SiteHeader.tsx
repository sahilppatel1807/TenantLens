import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Logo } from "./Logo";

export const SiteHeader = () => (
  <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
    <div className="container flex h-16 items-center justify-between">
      <Logo />
      <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
        <a href="#features" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
          Features
        </a>
        <a href="#scoring" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
          How scoring works
        </a>
        <a href="#workflow" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
          Workflow
        </a>
      </nav>
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to="/login">Log in</Link>
        </Button>
        <Button asChild size="sm">
          <Link to="/register">Start free</Link>
        </Button>
      </div>
    </div>
  </header>
);
