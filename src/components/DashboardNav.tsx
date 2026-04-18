import { Link, NavLink } from "react-router-dom";
import { Logo } from "./Logo";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const navItems = [
  { to: "/dashboard", label: "Properties", end: true },
  { to: "/dashboard/applicants", label: "Applicants" },
];

export const DashboardNav = () => (
  <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md">
    <div className="container flex h-16 items-center justify-between gap-6">
      <div className="flex items-center gap-8">
        <Logo to="/dashboard" />
        <nav className="hidden items-center gap-1 md:flex" aria-label="Dashboard">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/">Back to site</Link>
        </Button>
        <Avatar className="h-9 w-9 border border-border">
          <AvatarFallback className="bg-accent-soft text-xs font-semibold text-accent">PM</AvatarFallback>
        </Avatar>
      </div>
    </div>
  </header>
);
