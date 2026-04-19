"use client";

import { Suspense, useEffect, useState } from "react";
import { CheckCircle2, CreditCard } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { DashboardNav } from "@/components/DashboardNav";
import { PricingPaidCheckoutButton } from "@/components/pricing-paid-checkout-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { hasPaidSubscription } from "@/lib/billing/profile-billing";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

function BillingMain() {
  const searchParams = useSearchParams();
  const fromPaidLanding = searchParams.get("plan") === "paid";
  const checkoutSuccess = searchParams.get("success") === "true";
  const [hasPaidPlan, setHasPaidPlan] = useState(false);
  const [billingLoaded, setBillingLoaded] = useState(false);

  const searchKey = searchParams.toString();

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setBillingLoaded(true);
      return;
    }
    let cancelled = false;

    async function loadBilling(): Promise<boolean> {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) {
        setBillingLoaded(true);
        return false;
      }
      const { data } = await supabase
        .from("profiles")
        .select("stripe_subscription_id, subscription_status")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return false;
      const paid = hasPaidSubscription(data);
      setHasPaidPlan(paid);
      setBillingLoaded(true);
      return paid;
    }

    void (async () => {
      let paid = await loadBilling();
      if (!checkoutSuccess || paid || cancelled) return;
      for (let i = 0; i < 20 && !cancelled && !paid; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        paid = await loadBilling();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchKey, checkoutSuccess]);

  return (
    <main className="container max-w-3xl space-y-8 py-8 md:py-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Billing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your TenantLens account is separate from billing. The first three active listings are free; subscribe when
          you need more than three active listings at once.
        </p>
      </div>

      {fromPaidLanding ? (
        <Alert className="border-accent/40 bg-accent-soft/30">
          <CheckCircle2 className="h-4 w-4 text-accent" aria-hidden />
          <AlertTitle>Account ready</AlertTitle>
          <AlertDescription>
            You signed up from the paid plan. Your first three active listings stay free; subscribe when you add a
            fourth active listing.
          </AlertDescription>
        </Alert>
      ) : null}

      {hasPaidPlan ? (
        <Alert>
          <CheckCircle2 className="h-4 w-4 text-accent" aria-hidden />
          <AlertTitle>Subscription active</AlertTitle>
          <AlertDescription>
            Extra active listings are billed automatically based on how many active listings you have at any time.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-muted-foreground" aria-hidden />
            <CardTitle>TenantLens subscription</CardTitle>
          </div>
          <CardDescription>
            First three active listings free, then $15 AUD per additional active listing / month. Cancel anytime.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
              <span>Includes unlimited applicants and full scoring on every listing.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
              <span>Secure checkout with Stripe — you stay signed in to TenantLens.</span>
            </li>
          </ul>
          {billingLoaded && !hasPaidPlan ? <PricingPaidCheckoutButton /> : null}
          {billingLoaded && hasPaidPlan ? (
            <p className="text-sm text-muted-foreground">You are on a paid plan. No need to check out again.</p>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}

export function BillingPage() {
  return (
    <div className="min-h-screen bg-secondary/30">
      <DashboardNav />
      <Suspense
        fallback={
          <main className="container max-w-3xl py-8 md:py-10">
            <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
            <div className="mt-4 h-4 w-full max-w-lg animate-pulse rounded-md bg-muted" />
          </main>
        }
      >
        <BillingMain />
      </Suspense>
    </div>
  );
}
