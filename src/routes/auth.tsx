import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { BookOpen, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { claimOwnerAdmin } from "@/lib/library.functions";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign In — Eclipsesoul Library" },
      { name: "description", content: "Restricted access portal for Eclipsesoul Library." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const claimOwner = useServerFn(claimOwnerAdmin);

  const redirectByRole = async (userId: string) => {
    // Self-service admin upgrade for the allow-listed email (no-op for others)
    try { await claimOwner(); } catch { /* ignore */ }
    const { data: userData } = await supabase.auth.getUser();
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const isOwner = userData.user?.email?.toLowerCase() === "nivishna689@gmail.com";
    const isAdmin = isOwner || roles?.some((r) => r.role === "admin");
    navigate({ to: isAdmin ? "/admin" : "/student" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName, role: "student" },
          },
        });
        if (error) throw error;
        toast.success("Session initialized");
        if (data.session) await redirectByRole(data.user!.id);
        else toast.message("Check your email to confirm — or sign in if confirmation is disabled.");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Access granted");
        await redirectByRole(data.user.id);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Authentication failed";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 relative">
      <div className="absolute inset-0 pointer-events-none opacity-30"
        style={{ backgroundImage: "radial-gradient(circle at 50% 30%, oklch(0.62 0.24 25 / 0.25), transparent 50%)" }} />

      <div className="relative w-full max-w-md card-surface rounded-xl p-8 neon-glow">
        <div className="flex flex-col items-center gap-3 mb-6">
          <div className="w-14 h-14 rounded-full border border-primary/60 flex items-center justify-center pulse-glow">
            <BookOpen className="w-7 h-7 text-primary" />
          </div>
          <h1 className="font-display text-3xl neon-text tracking-[0.25em]">ECLIPSESOUL</h1>
          <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-muted-foreground">
            Restricted Access
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">
                Identification
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Full name"
                className="w-full bg-input border border-border rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
          )}

          <div>
            <label className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="agent@eclipsesoul.lib"
              className="w-full bg-input border border-border rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">
              Passcode
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-input border border-border rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          {mode === "signup" && (
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground text-center">
              All new operatives enroll as Students. Admin clearance is granted by the head librarian.
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-primary-foreground rounded-md py-3 text-sm uppercase tracking-[0.3em] font-medium neon-glow hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2 transition"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === "signin" ? "Initialize Session" : "Request Access"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-primary transition"
          >
            {mode === "signin" ? "› Request new clearance" : "› Existing operative? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}
