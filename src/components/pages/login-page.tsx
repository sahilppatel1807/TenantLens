"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value;
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;

    setSubmitting(true);
    try {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        toast({
          title: "Configuration error",
          description:
            "Add NEXT_PUBLIC_SUPABASE_URL and either NEXT_PUBLIC_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env.local.",
          variant: "destructive",
        });
        return;
      }
      // Clear any existing session first so a failed attempt cannot leave you "still logged in"
      // as a previous user (Supabase does not remove the old session when password sign-in fails).
      await supabase.auth.signOut();

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.session) {
        toast({
          title: "Sign in failed",
          description: error?.message ?? "No session returned. Check your email and password.",
          variant: "destructive",
        });
        return;
      }
      const raw = searchParams.get("next");
      const paidIntent = searchParams.get("plan") === "paid";
      const fromNext =
        raw && raw.startsWith("/dashboard") && !raw.includes("//") && !raw.includes(":") ? raw : null;
      const next = fromNext ?? (paidIntent ? "/dashboard/billing?plan=paid" : "/dashboard");
      router.push(next);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to review applicants and manage your properties."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link
            href={searchParams.get("plan") === "paid" ? "/register?plan=paid" : "/register"}
            className="font-medium text-accent hover:underline"
          >
            Sign up
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Work email</Label>
          <Input id="email" name="email" type="email" placeholder="you@agency.com" autoComplete="email" required />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <button type="button" className="text-xs text-muted-foreground hover:text-foreground">
              Forgot?
            </button>
          </div>
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        <Button type="submit" className="w-full" size="lg" disabled={submitting}>
          {submitting ? "Signing in…" : "Log in"}
        </Button>
      </form>
    </AuthLayout>
  );
}
