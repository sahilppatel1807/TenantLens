import { ReactNode } from "react";
import Link from "next/link";
import { Logo } from "./Logo";

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}

export const AuthLayout = ({ title, subtitle, children, footer }: AuthLayoutProps) => (
  <div className="grid min-h-screen lg:grid-cols-2">
    <div className="flex flex-col px-6 py-8 lg:px-12">
      <Logo />
      <div className="flex flex-1 items-center justify-center py-12">
        <div className="w-full max-w-sm space-y-8 animate-fade-in">
          <header className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </header>
          {children}
          <p className="text-center text-sm text-muted-foreground">{footer}</p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        <Link href="/" className="hover:text-foreground">← Back to home</Link>
      </p>
    </div>

    <div className="relative hidden overflow-hidden gradient-hero lg:block">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(188_70%_50%/0.3),transparent_50%)]" />
      <div className="relative flex h-full flex-col justify-end p-12 text-primary-foreground">
        <blockquote className="space-y-4">
          <p className="text-balance text-2xl font-medium leading-snug">
            &quot;What used to take an afternoon now takes 15 minutes. Our team finally has time to actually talk to landlords.&quot;
          </p>
          <footer className="text-sm text-primary-foreground/70">
            — Property Manager, Metro Realty
          </footer>
        </blockquote>
      </div>
    </div>
  </div>
);
