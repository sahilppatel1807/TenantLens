import { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const Login = () => {
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
      title="Welcome back"
      subtitle="Log in to review applicants and manage your properties."
      footer={
        <>
          Don't have an account?{" "}
          <Link to="/register" className="font-medium text-accent hover:underline">
            Sign up
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Work email</Label>
          <Input id="email" type="email" placeholder="you@agency.com" autoComplete="email" required />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <button type="button" className="text-xs text-muted-foreground hover:text-foreground">
              Forgot?
            </button>
          </div>
          <Input id="password" type="password" autoComplete="current-password" required />
        </div>
        <Button type="submit" className="w-full" size="lg">
          Log in
        </Button>
      </form>
    </AuthLayout>
  );
};

export default Login;
