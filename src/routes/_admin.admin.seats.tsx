import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Armchair, Plus, Power, X } from "lucide-react";

export const Route = createFileRoute("/_admin/admin/seats")({
  head: () => ({ meta: [{ title: "Seat Management — Admin" }] }),
  component: AdminSeats,
});

function AdminSeats() {
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const [zone, setZone] = useState("Silent Zone");
  const [type, setType] = useState("seat");

  const { data: seats } = useQuery({
    queryKey: ["admin-seats"],
    queryFn: async () => {
      const { data } = await supabase.from("seats").select("*").order("code");
      return data ?? [];
    },
  });

  const { data: today } = useQuery({
    queryKey: ["seat-res-all"],
    queryFn: async () => {
      const { data } = await supabase
        .from("seat_reservations")
        .select("*, seats(code, zone)")
        .order("start_time", { ascending: false })
        .limit(200);
      const rows = data ?? [];
      const ids = Array.from(new Set(rows.map((r: any) => r.student_id)));
      const profiles = ids.length
        ? (await supabase.from("profiles").select("id, full_name, email").in("id", ids)).data ?? []
        : [];
      const m = new Map(profiles.map((p: any) => [p.id, p]));
      return rows.map((r: any) => ({ ...r, profile: m.get(r.student_id) }));
    },
  });

  const cancelRes = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("seat_reservations").update({ status: "cancelled" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Reservation cancelled");
      qc.invalidateQueries({ queryKey: ["seat-res-all"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!code.trim()) throw new Error("Code required");
      const { error } = await supabase.from("seats").insert({ code: code.trim(), zone, type, is_active: true });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Seat added");
      setCode("");
      qc.invalidateQueries({ queryKey: ["admin-seats"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("seats").update({ is_active: active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-seats"] }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight flex items-center gap-3">
          <Armchair className="w-7 h-7 text-primary" /> Seat Management
        </h1>
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground mt-2">
          {seats?.filter((s: any) => s.is_active).length ?? 0} active · {today?.length ?? 0} bookings today
        </p>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); add.mutate(); }}
        className="card-surface rounded-lg p-5 grid sm:grid-cols-[1fr_1fr_1fr_auto] gap-3"
      >
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Code (e.g. S-05)"
          className="bg-input border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary" />
        <input value={zone} onChange={(e) => setZone(e.target.value)} placeholder="Zone"
          className="bg-input border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary" />
        <select value={type} onChange={(e) => setType(e.target.value)}
          className="bg-input border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary">
          <option value="seat">Seat</option>
          <option value="room">Room</option>
        </select>
        <button type="submit" className="inline-flex items-center gap-1 bg-primary text-primary-foreground rounded-md px-4 py-2 text-xs uppercase tracking-[0.3em] hover:bg-primary/90">
          <Plus className="w-3 h-3" /> Add
        </button>
      </form>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <h2 className="text-sm font-semibold mb-2">All Seats</h2>
          <div className="card-surface rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50">
                <tr className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  <th className="text-left px-4 py-3">Code</th>
                  <th className="text-left px-4 py-3">Zone</th>
                  <th className="text-left px-4 py-3">Type</th>
                  <th className="text-right px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {seats?.map((s: any) => (
                  <tr key={s.id} className="border-t border-border">
                    <td className="px-4 py-3 font-mono">{s.code}</td>
                    <td className="px-4 py-3 text-xs">{s.zone}</td>
                    <td className="px-4 py-3 text-xs">{s.type}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => toggle.mutate({ id: s.id, active: !s.is_active })}
                        className={`inline-flex items-center gap-1 text-xs px-2 py-1 border border-border rounded ${
                          s.is_active ? "text-emerald-400" : "text-muted-foreground"
                        }`}>
                        <Power className="w-3 h-3" /> {s.is_active ? "Active" : "Disabled"}
                      </button>
                    </td>
                  </tr>
                ))}
                {!seats?.length && <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground text-sm">No seats configured.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold mb-2">Seat Bookings</h2>
          <div className="card-surface rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50">
                <tr className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  <th className="text-left px-4 py-3">Seat</th>
                  <th className="text-left px-4 py-3">Student</th>
                  <th className="text-left px-4 py-3">When</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-right px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {today?.map((r: any) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-4 py-3 font-mono">{r.seats?.code}</td>
                    <td className="px-4 py-3 text-xs">{r.profile?.full_name ?? r.profile?.email ?? "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {new Date(r.start_time).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      {" → "}
                      {new Date(r.end_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded ${
                        r.status === "cancelled" ? "bg-muted text-muted-foreground" :
                        r.status === "completed" ? "bg-emerald-500/20 text-emerald-400" :
                        "bg-primary/20 text-primary"
                      }`}>{r.status ?? "active"}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {r.status !== "cancelled" && (
                        <button
                          onClick={() => cancelRes.mutate(r.id)}
                          disabled={cancelRes.isPending}
                          className="inline-flex items-center gap-1 text-xs px-2 py-1 border border-border rounded hover:bg-destructive/20 hover:text-destructive"
                        >
                          <X className="w-3 h-3" /> Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {!today?.length && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-sm">No bookings yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
