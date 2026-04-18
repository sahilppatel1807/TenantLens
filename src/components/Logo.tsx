import { ScanSearch } from "lucide-react";
import { Link } from "react-router-dom";

interface LogoProps {
  to?: string;
  className?: string;
}

export const Logo = ({ to = "/", className = "" }: LogoProps) => (
  <Link to={to} className={`inline-flex items-center gap-2 group ${className}`}>
    <span className="flex h-9 w-9 items-center justify-center rounded-lg gradient-hero shadow-soft transition-transform group-hover:scale-105">
      <ScanSearch className="h-5 w-5 text-primary-foreground" strokeWidth={2.4} />
    </span>
    <span className="text-lg font-bold tracking-tight text-foreground">
      Tenant<span className="text-accent">Lens</span>
    </span>
  </Link>
);
