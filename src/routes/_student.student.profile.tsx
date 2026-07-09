import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { User, Shield } from "lucide-react";

export const Route = createFileRoute("/_student/student/profile")({
  head: () => ({ meta: [{ title: "Profile — Eclipsesoul" }] }),
  component: Profile,
});

function Profile() {
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const [me, setMe] = useState<{ id: string; email: string } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setMe({ id: data.user.id, email: data.user.email ?? "" });
    });
  }, []);

  const { data: profile } = useQuery({
    enabled: !!me,
    queryKey: ["profile-me", me?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", me!.id).maybeSingle();
      return data;
    },
  });

  const { data: requests } = useQuery({
    enabled: !!me,
    queryKey: ["my-admin-requests", me?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("admin_requests").select("*").eq("user_id", me!.id).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const request = useMutation({
    mutationFn: async () => {
      if (!me) throw new Error("Sign in");
      const { error } = await supabase.from("admin_requests").insert({
        user_id: me.id, reason: reason || null, status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Request sent — the owner will review it.");
      setReason("");
      qc.invalidateQueries({ queryKey: ["my-admin-requests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const hasPending = requests?.some((r: any) => r.status === "pending");

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight flex items-center gap-3">
          <User className="w-7 h-7 text-primary" /> Profile
        </h1>
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground mt-2">Account Settings</p>
      </div>

      <div className="card-surface rounded-lg p-6 space-y-3">
        <Field label="Name" value={profile?.full_name ?? "—"} />
        <Field label="Email" value={me?.email ?? "—"} />
        <Field label="Student Code" value={profile?.student_code ?? "—"} />
        <Field label="Department" value={profile?.department ?? "—"} />
        <Field label="Year" value={profile?.year ?? "—"} />
        <Field label="Phone" value={profile?.phone ?? "—"} />
      </div>

      <div className="card-surface rounded-lg p-6 space-y-4 neon-glow">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Request Admin Access</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Send a request to the library owner. Only the owner can approve admin access.
        </p>
        <form onSubmit={(e) => { e.preventDefault(); request.mutate(); }} className="space-y-3">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Why do you need admin access?"
            className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary"
          />
          <button
            type="submit"
            disabled={request.isPending || hasPending}
            className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-xs uppercase tracking-[0.3em] hover:bg-primary/90 disabled:opacity-50"
          >
            {hasPending ? "Request pending" : "Send Request"}
          </button>
        </form>

        {!!requests?.length && (
          <div className="border-t border-border pt-3 mt-3 space-y-2">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Recent</div>
            {requests.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between text-xs">
                <span className="truncate text-muted-foreground">{r.reason || "—"}</span>
                <span className={`uppercase tracking-widest px-2 py-0.5 rounded text-[10px] ${
                  r.status === "approved" ? "bg-emerald-500/20 text-emerald-400" :
                  r.status === "rejected" ? "bg-muted text-muted-foreground" :
                  "bg-primary/20 text-primary"
                }`}>{r.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-4">
      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground w-32 shrink-0">{label}</div>
      <div className="text-sm">{value}</div>
    </div>
  );
}
