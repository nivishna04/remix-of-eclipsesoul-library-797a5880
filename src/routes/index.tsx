import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Eclipsesoul Library — Initializing" },
      { name: "description", content: "Stranger Things inspired library management system." },
    ],
  }),
  component: Boot,
});

function Boot() {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let mounted = true;
    const t = setInterval(() => {
      setProgress((p) => Math.min(100, p + Math.random() * 18));
    }, 180);

    const go = async () => {
      const { data } = await supabase.auth.getSession();
      await new Promise((r) => setTimeout(r, 1800));
      if (!mounted) return;
      if (data.session) {
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", data.session.user.id);
        const isOwner = data.session.user.email?.toLowerCase() === "nivishna689@gmail.com";
        const isAdmin = isOwner || roles?.some((r) => r.role === "admin");
        navigate({ to: isAdmin ? "/admin" : "/student" });
      } else {
        navigate({ to: "/auth" });
      }
    };
    go();
    return () => { mounted = false; clearInterval(t); };
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="text-center space-y-6">
        <h1 className="font-display text-5xl md:text-7xl neon-text tracking-[0.3em] flicker">
          ECLIPSESOUL
        </h1>
        <p className="font-mono text-xs md:text-sm uppercase tracking-[0.4em] text-muted-foreground">
          Initializing System
        </p>
        <div className="mx-auto w-64 h-12 flex items-center justify-center">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 rounded-full border-2 border-primary/30" />
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary animate-spin pulse-glow" />
          </div>
        </div>
        <div className="mx-auto w-64 h-1 bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-200 pulse-glow"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
          Restricted Access · v1.0
        </p>
      </div>
    </div>
  );
}
