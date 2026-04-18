import { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const Register = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    toast({
      title: "Auth not connected yet",
      description: "Backend will be wired up in the next phase. Taking you to the dashboard preview.",
    });
    setTimeout(() => navigate("/dashboard"), 600);
  };

  return (
    <AuthLayout
      title="Create your TenantLens account"
      subtitle="Free to start. No credit card required."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-accent hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="firstName">First name</Label>
            <Input id="firstName" autoComplete="given-name" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">Last name</Label>
            <Input id="lastName" autoComplete="family-name" required />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="agency">Agency name</Label>
          <Input id="agency" placeholder="Metro Realty" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Work email</Label>
          <Input id="email" type="email" placeholder="you@agency.com" autoComplete="email" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" autoComplete="new-password" required />
        </div>
        <Button type="submit" className="w-full" size="lg">
          Create account
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          By signing up, you agree to our terms and privacy policy.
        </p>
      </form>
    </AuthLayout>
  );
};

export default Register;
