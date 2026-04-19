"use client";

import { useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { startSubscriptionCheckout } from "@/lib/stripe/start-subscription-checkout";

export function PricingPaidCheckoutButton() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const onClick = async () => {
    setLoading(true);
    try {
      await startSubscriptionCheckout();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not start checkout.";
      toast({ title: "Checkout failed", description: message, variant: "destructive" });
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="hero"
      size="lg"
      className="w-full"
      disabled={loading}
      aria-busy={loading}
      onClick={() => void onClick()}
    >
      {loading ? (
        <>
          <Loader2 className="mr-1.5 h-4 w-4 shrink-0 animate-spin" aria-hidden />
          Get started <ArrowRight />
        </>
      ) : (
        <>
          Get started <ArrowRight />
        </>
      )}
    </Button>
  );
}
