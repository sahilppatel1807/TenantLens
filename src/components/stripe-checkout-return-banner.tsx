"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function StripeCheckoutReturnBanner() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const state = useMemo(() => {
    const success = searchParams.get("success") === "true";
    const canceled = searchParams.get("canceled") === "true";
    if (success) return { kind: "success" as const };
    if (canceled) return { kind: "canceled" as const };
    return null;
  }, [searchParams]);

  if (!state) return null;

  const dismiss = () => {
    router.replace(pathname);
  };

  if (state.kind === "success") {
    return (
      <div className="container pt-4">
        <Alert className="border-accent/40 bg-accent-soft/30">
          <CheckCircle2 className="h-4 w-4 text-accent" aria-hidden />
          <AlertTitle>Payment successful</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-muted-foreground">
              You can add or activate your fourth listing now — billing updates automatically after that.
            </span>
            <Button type="button" variant="outline" size="sm" onClick={dismiss}>
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container pt-4">
      <Alert variant="destructive">
        <XCircle className="h-4 w-4" aria-hidden />
        <AlertTitle>Payment canceled</AlertTitle>
        <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
          <span>You can try again whenever you are ready.</span>
          <Button type="button" variant="outline" size="sm" onClick={dismiss}>
            Dismiss
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  );
}
