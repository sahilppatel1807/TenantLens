import { Suspense } from "react";
import { RegisterPage } from "@/components/pages/register-page";
import { Skeleton } from "@/components/ui/skeleton";

function RegisterFallback() {
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <Skeleton className="h-10 w-64" />
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<RegisterFallback />}>
      <RegisterPage />
    </Suspense>
  );
}
