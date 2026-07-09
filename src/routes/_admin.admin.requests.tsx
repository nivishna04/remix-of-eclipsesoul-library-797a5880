import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { decideAdminRequest } from "@/lib/library.functions";
import { toast } from "sonner";
import { Shield, Check, X } from "lucide-react";

export const Route = createFileRoute("/_admin/admin/requests")({
  head: () => ({ meta: [{ title: "Admin Requests" }] }),
  component: AdminRequests,
});

const OWNER = "nivishna689@gmail.com";

function AdminRequests() {
  const qc = useQueryClient();
  const [me, setMe] = useState("");
  const decideRequest = useServerFn(decideAdminRequest);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMe(data.user?.email?.toLowerCase() ?? ""));
  }, []);

  const { data: rows } = useQuery({
    queryKey: ["admin-requests"],
    queryFn: async () => {
      const { data } = await supabase
        .from("admin_requests")
        .select("*")
        .order("created_at", { ascending: false });
      const ids = Array.from(new Set((data ?? []).map((r: any) => r.user_id)));
      const profiles = ids.length
        ? (await supabase.from("profiles").select("id, full_name, email").in("id", ids)).data ?? []
        : [];
      const m = new Map(profiles.map((p: any) => [p.id, p]));
      return (data ?? []).map((r: any) => ({ ...r, profile: m.get(r.user_id) }));
    },
  });

  const decide = useMutation({
    mutationFn: async ({ id, approve }: { id: string; approve: boolean }) => {
      return decideRequest({ data: { id, approve } });
    },
    onSuccess: () => {
      toast.success("Decision recorded");
      qc.invalidateQueries({ queryKey: ["admin-requests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const isOwner = me === OWNER;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight flex items-center gap-3">
          <Shield className="w-7 h-7 text-primary" /> Admin Access Requests
        </h1>
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground mt-2">
          {isOwner ? "Owner controls — approve or reject" : "Read-only — only the owner can decide"}
        </p>
      </div>

      <div className="card-surface rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50">
            <tr className="text-[10px] uppercase tracking-widest text-muted-foreground">
              <th className="text-left px-4 py-3">User</th>
              <th className="text-left px-4 py-3">Reason</th>
              <th className="text-left px-4 py-3">Requested</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-right px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows?.map((r: any) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-4 py-3">
                  <div className="font-medium">{r.profile?.full_name ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">{r.profile?.email}</div>
                </td>
                <td className="px-4 py-3 text-xs max-w-md">{r.reason || "—"}</td>
                <td className="px-4 py-3 font-mono text-xs">{new Date(r.created_at).toLocaleString()}</td>
                <td className="px-4 py-3">
                  <span className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded ${
                    r.status === "approved" ? "bg-emerald-500/20 text-emerald-400" :
                    r.status === "rejected" ? "bg-muted text-muted-foreground" :
                    "bg-primary/20 text-primary"
                  }`}>{r.status}</span>
                </td>
                <td className="px-4 py-3 text-right space-x-2">
                  {r.status === "pending" && isOwner && (
                    <>
                      <button onClick={() => decide.mutate({ id: r.id, approve: true })}
                        className="inline-flex items-center gap-1 text-xs px-2 py-1 border border-border rounded hover:bg-emerald-500/20 hover:text-emerald-400">
                        <Check className="w-3 h-3" /> Approve
                      </button>
                      <button onClick={() => decide.mutate({ id: r.id, approve: false })}
                        className="inline-flex items-center gap-1 text-xs px-2 py-1 border border-border rounded hover:bg-destructive/20 hover:text-destructive">
                        <X className="w-3 h-3" /> Reject
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {!rows?.length && (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-muted-foreground">No requests yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
