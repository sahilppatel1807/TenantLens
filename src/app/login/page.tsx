import { Suspense } from "react";
import { LoginPage } from "@/components/pages/login-page";
import { Skeleton } from "@/components/ui/skeleton";

function LoginFallback() {
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <Skeleton className="h-10 w-64" />
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginPage />
    </Suspense>
  );
}
