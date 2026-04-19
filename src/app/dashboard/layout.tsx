import { DataProvider } from "@/lib/store";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <DataProvider>{children}</DataProvider>;
}
