"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, Bot } from "lucide-react";
import { toast } from "sonner";

export default function LoginPage() {
  const { signIn } = useAuthActions();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();
  const [isSignUp, setIsSignUp] = useState(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isLoading, isAuthenticated, router]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signIn("password", {
        email,
        password,
        ...(isSignUp ? { name, flow: "signUp" } : { flow: "signIn" }),
      });
    } catch {
      const msg = isSignUp ? "Failed to create account." : "Invalid credentials.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
      {/* Gradient mesh background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="orb -top-32 -left-32 h-[500px] w-[500px] bg-indigo-600/20 animate-pulse" style={{ animationDuration: "6s" }} />
        <div className="orb -bottom-32 -right-32 h-[400px] w-[400px] bg-emerald-500/12 animate-pulse" style={{ animationDuration: "8s" }} />
        <div className="orb top-1/4 right-1/4 h-[300px] w-[300px] bg-violet-500/8 animate-pulse" style={{ animationDuration: "10s" }} />
      </div>

      {/* Grid pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: "linear-gradient(oklch(1 0 0 / 8%) 1px, transparent 1px), linear-gradient(90deg, oklch(1 0 0 / 8%) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      <div className="relative z-10 w-full max-w-sm px-4">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 ring-1 ring-white/[0.08] backdrop-blur-sm">
            <Bot className="h-7 w-7 text-indigo-400" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-gradient">Berry Claw</h1>
          <p className="text-sm text-muted-foreground">OpenClaw Management Platform</p>
        </div>

        <Card className="glass gradient-border glow-indigo">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-lg">
              {isSignUp ? "Create your account" : "Welcome back"}
            </CardTitle>
            <CardDescription className="text-muted-foreground/80">
              {isSignUp ? "Start managing your AI assistants" : "Sign in to continue"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {isSignUp && (
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-xs font-medium text-muted-foreground">Name</Label>
                  <div className="input-glow rounded-lg">
                    <Input
                      id="name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                      className="bg-white/[0.06] border-white/[0.10] transition-all duration-300 focus-visible:bg-white/[0.08]"
                    />
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-medium text-muted-foreground">Email</Label>
                <div className="input-glow rounded-lg">
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="bg-white/[0.06] border-white/[0.10] transition-all duration-300 focus-visible:bg-white/[0.08]"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs font-medium text-muted-foreground">Password</Label>
                <div className="input-glow rounded-lg">
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="bg-white/[0.06] border-white/[0.10] transition-all duration-300 focus-visible:bg-white/[0.08]"
                  />
                </div>
              </div>
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              <Button
                type="submit"
                className="w-full btn-gradient text-white font-medium"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {loading
                  ? "Loading..."
                  : isSignUp
                    ? "Create Account"
                    : "Sign In"}
              </Button>
            </form>
            <div className="divider-gradient mt-6 mb-4" />
            <div className="text-center text-sm">
              <span className="text-muted-foreground/80">
                {isSignUp ? "Already have an account?" : "Don't have an account?"}
              </span>{" "}
              <button
                type="button"
                className="font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setError("");
                }}
              >
                {isSignUp ? "Sign in" : "Sign up"}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
