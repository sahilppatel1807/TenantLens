"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Logo } from "./Logo";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

const navItems = [
  { href: "/dashboard", label: "Properties", end: true as const },
  { href: "/dashboard/applicants", label: "Applicants", end: false as const },
  { href: "/dashboard/billing", label: "Billing", end: false as const },
] as const;

function navLinkActive(pathname: string, href: string, end: boolean) {
  if (end) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function initials(fullName: string, emailFallback: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 2);
  if (parts.length === 1 && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "?";
  const e = emailFallback.trim();
  return e.slice(0, 2).toUpperCase() || "?";
}

export const DashboardNav = () => {
  const pathname = usePathname();
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled || !user) return;
      setUserEmail(user.email ?? "");
      const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
      if (cancelled) return;
      setDisplayName(profile?.full_name?.trim() || user.email?.split("@")[0] || "");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signOut = async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between gap-6">
        <div className="flex items-center gap-8">
          <Logo href="/dashboard" />
          <nav className="hidden items-center gap-1 md:flex" aria-label="Dashboard">
            {navItems.map((item) => {
              const active = navLinkActive(pathname, item.href, item.end);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link href="/">Back to site</Link>
          </Button>
          <Button type="button" variant="ghost" size="sm" className="gap-1 text-muted-foreground" onClick={() => void signOut()}>
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Log out</span>
          </Button>
          <Avatar className="h-9 w-9 border border-border">
            <AvatarFallback className="bg-accent-soft text-xs font-semibold text-accent">
              {initials(displayName, userEmail)}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  );
};
