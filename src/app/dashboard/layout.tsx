import { Suspense } from "react";
import { StripeCheckoutReturnBanner } from "@/components/stripe-checkout-return-banner";
import { DataProvider } from "@/lib/store";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DataProvider>
      <Suspense fallback={null}>
        <StripeCheckoutReturnBanner />
      </Suspense>
      {children}
    </DataProvider>
  );
}
