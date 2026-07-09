import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check, X } from "lucide-react";

export const Route = createFileRoute("/_admin/admin/reservations")({
  head: () => ({ meta: [{ title: "Reservations — Admin" }] }),
  component: AdminReservations,
});

function AdminReservations() {
  const qc = useQueryClient();
  const { data: rows } = useQuery({
    queryKey: ["all-reservations"],
    queryFn: async () => {
      const { data } = await supabase
        .from("reservations")
        .select("*, books(title, author)")
        .order("reserved_at", { ascending: false });
      const ids = Array.from(new Set((data ?? []).map((r: any) => r.student_id)));
      const profiles = ids.length
        ? (await supabase.from("profiles").select("id, full_name, email").in("id", ids)).data ?? []
        : [];
      const map = new Map(profiles.map((p: any) => [p.id, p]));
      return (data ?? []).map((r: any) => ({ ...r, profiles: map.get(r.student_id) }));
    },
  });

  const resolve = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("reservations")
        .update({ status, resolved_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["all-reservations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Reservations</h1>
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground mt-2">
          {rows?.filter((r) => r.status === "pending").length ?? 0} Pending · {rows?.length ?? 0} Total
        </p>
      </div>

      <div className="card-surface rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50">
            <tr className="text-[10px] uppercase tracking-widest text-muted-foreground">
              <th className="text-left px-4 py-3">Book</th>
              <th className="text-left px-4 py-3">Student</th>
              <th className="text-left px-4 py-3">Placed</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-right px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows?.map((r: any) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-4 py-3">
                  <div className="font-medium">{r.books?.title}</div>
                  <div className="text-xs text-muted-foreground">{r.books?.author}</div>
                </td>
                <td className="px-4 py-3">
                  <div>{r.profiles?.full_name ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">{r.profiles?.email}</div>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                  {new Date(r.reserved_at).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded ${
                    r.status === "pending" ? "bg-primary/20 text-primary" :
                    r.status === "fulfilled" ? "bg-emerald-500/20 text-emerald-400" :
                    "bg-muted text-muted-foreground"
                  }`}>{r.status}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  {r.status === "pending" && (
                    <div className="inline-flex gap-2">
                      <button
                        onClick={() => resolve.mutate({ id: r.id, status: "fulfilled" })}
                        className="p-1.5 rounded bg-secondary hover:bg-emerald-500 hover:text-white"
                        aria-label="Fulfill"
                      ><Check className="w-3 h-3" /></button>
                      <button
                        onClick={() => resolve.mutate({ id: r.id, status: "cancelled" })}
                        className="p-1.5 rounded bg-secondary hover:bg-destructive hover:text-destructive-foreground"
                        aria-label="Cancel"
                      ><X className="w-3 h-3" /></button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {!rows?.length && (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-muted-foreground">No reservations yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
