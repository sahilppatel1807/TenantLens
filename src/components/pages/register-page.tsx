"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export function RegisterPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const firstName = (form.elements.namedItem("firstName") as HTMLInputElement).value;
    const lastName = (form.elements.namedItem("lastName") as HTMLInputElement).value;
    const agency = (form.elements.namedItem("agency") as HTMLInputElement).value;
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
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: `${firstName.trim()} ${lastName.trim()}`.trim(),
            agency_name: agency.trim(),
          },
        },
      });
      if (error) {
        toast({
          title: "Could not create account",
          description: error.message,
          variant: "destructive",
        });
        return;
      }
      if (data.session) {
        router.push("/dashboard");
        router.refresh();
        return;
      }
      toast({
        title: "Check your email",
        description: "Confirm your address to finish signing up, then return here to log in.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Create your TenantLens account"
      subtitle="Free to start. No credit card required."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-accent hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="firstName">First name</Label>
            <Input id="firstName" name="firstName" autoComplete="given-name" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">Last name</Label>
            <Input id="lastName" name="lastName" autoComplete="family-name" required />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="agency">Agency name</Label>
          <Input id="agency" name="agency" placeholder="Metro Realty" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Work email</Label>
          <Input id="email" name="email" type="email" placeholder="you@agency.com" autoComplete="email" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
        </div>
        <Button type="submit" className="w-full" size="lg" disabled={submitting}>
          {submitting ? "Creating…" : "Create account"}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          By signing up, you agree to our terms and privacy policy.
        </p>
      </form>
    </AuthLayout>
  );
}
