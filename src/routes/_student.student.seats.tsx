import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Armchair, Calendar, CheckCircle2, Loader2, X } from "lucide-react";

export const Route = createFileRoute("/_student/student/seats")({
  head: () => ({ meta: [{ title: "Seat Booking — Eclipsesoul" }] }),
  component: StudentSeats,
});

function todayLocal() {
  return new Date().toISOString().slice(0, 10);
}

function StudentSeats() {
  const qc = useQueryClient();
  const [date, setDate] = useState(todayLocal());
  const [startHour, setStartHour] = useState(9);
  const [endHour, setEndHour] = useState(11);
  const [zone, setZone] = useState<string>("all");
  const [conflict, setConflict] = useState<{ seatId: string; seatCode: string; who: string; suggestStart: number; suggestEnd: number } | null>(null);

  const { data: seats } = useQuery({
    queryKey: ["seats"],
    queryFn: async () => {
      const { data, error } = await supabase.from("seats").select("*").eq("is_active", true).order("code");
      if (error) throw error;
      return data ?? [];
    },
  });

  const startISO = new Date(`${date}T${String(startHour).padStart(2, "0")}:00:00`).toISOString();
  const endISO = new Date(`${date}T${String(endHour).padStart(2, "0")}:00:00`).toISOString();

  const { data: reservations } = useQuery({
    queryKey: ["seat-res-window", startISO, endISO],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("seat_reservations")
        .select("*")
        .neq("status", "cancelled")
        .lt("start_time", endISO)
        .gt("end_time", startISO);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: mine } = useQuery({
    queryKey: ["my-seat-res"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      const { data, error } = await supabase
        .from("seat_reservations")
        .select("*, seats(code, zone, type)")
        .eq("student_id", u.user.id)
        .order("start_time", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  const taken = new Set((reservations ?? []).map((r: any) => r.seat_id));
  const zones = Array.from(new Set((seats ?? []).map((s: any) => s.zone)));

  const book = useMutation({
    mutationFn: async (seatId: string) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sign in first");
      if (endHour <= startHour) throw new Error("End time must be after start time");
      setConflict(null);
      // Re-check availability right before insert to avoid a race
      const { data: clash } = await supabase
        .from("seat_reservations")
        .select("id, student_id, start_time, end_time, seats(code)")
        .eq("seat_id", seatId)
        .neq("status", "cancelled")
        .lt("start_time", endISO)
        .gt("end_time", startISO)
        .limit(1);
      if (clash && clash.length) {
        const c: any = clash[0];
        const prof = await supabase
          .from("profiles")
          .select("full_name, email")
          .eq("id", c.student_id)
          .maybeSingle();
        const who = prof.data?.full_name || prof.data?.email || "another student";
        // Compute the next free slot of the same duration on the same day after the conflict ends.
        const duration = endHour - startHour;
        const all = await supabase
          .from("seat_reservations")
          .select("start_time, end_time")
          .eq("seat_id", seatId)
          .neq("status", "cancelled")
          .gte("start_time", new Date(`${date}T00:00:00`).toISOString())
          .lt("start_time", new Date(`${date}T23:59:59`).toISOString());
        const taken = (all.data ?? []).map((r: any) => ({
          s: new Date(r.start_time).getHours(),
          e: new Date(r.end_time).getHours(),
        }));
        let candidate = new Date(c.end_time).getHours();
        let suggested = -1;
        for (let h = candidate; h + duration <= 21; h++) {
          const overlaps = taken.some((t) => h < t.e && h + duration > t.s);
          if (!overlaps) { suggested = h; break; }
        }
        setConflict({
          seatId,
          seatCode: c.seats?.code ?? "",
          who,
          suggestStart: suggested,
          suggestEnd: suggested >= 0 ? suggested + duration : -1,
        });
        const win = `${new Date(c.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} → ${new Date(c.end_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
        throw new Error(`Seat ${c.seats?.code ?? ""} already booked by ${who} (${win}).`);
      }
      const { error } = await supabase.from("seat_reservations").insert({
        seat_id: seatId,
        student_id: u.user.id,
        start_time: startISO,
        end_time: endISO,
        status: "confirmed",
      });
      if (error) throw new Error(error.message || "Seat unavailable for this window");
    },
    onSuccess: () => {
      toast.success("Seat booked");
      setConflict(null);
      qc.invalidateQueries({ queryKey: ["seat-res-window"] });
      qc.invalidateQueries({ queryKey: ["my-seat-res"] });
    },
    onError: (e: Error) => toast.error(e.message, { duration: 6000 }),
  });

  const cancel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("seat_reservations")
        .update({ status: "cancelled" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cancelled");
      qc.invalidateQueries({ queryKey: ["seat-res-window"] });
      qc.invalidateQueries({ queryKey: ["my-seat-res"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const visible = (seats ?? []).filter((s: any) => zone === "all" || s.zone === zone);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight flex items-center gap-3">
          <Armchair className="w-7 h-7 text-primary" /> Seat Booking
        </h1>
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground mt-2">
          Reserve a desk or study room
        </p>
      </div>

      <div className="card-surface rounded-lg p-5 grid sm:grid-cols-4 gap-3">
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">Date</label>
          <input type="date" value={date} min={todayLocal()} onChange={(e) => setDate(e.target.value)}
            className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary" />
        </div>
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">Start</label>
          <select value={startHour} onChange={(e) => setStartHour(Number(e.target.value))}
            className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary">
            {Array.from({ length: 14 }, (_, i) => i + 7).map((h) => (
              <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">End</label>
          <select value={endHour} onChange={(e) => setEndHour(Number(e.target.value))}
            className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary">
            {Array.from({ length: 14 }, (_, i) => i + 8).map((h) => (
              <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">Zone</label>
          <select value={zone} onChange={(e) => setZone(e.target.value)}
            className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary">
            <option value="all">All zones</option>
            {zones.map((z) => <option key={z} value={z}>{z}</option>)}
          </select>
        </div>
      </div>

      {conflict && (
        <div className="card-surface rounded-lg p-4 border border-destructive/50 bg-destructive/5 flex items-start gap-3 flex-wrap">
          <X className="w-4 h-4 text-destructive mt-0.5" />
          <div className="flex-1 min-w-[200px]">
            <div className="text-sm font-semibold">Seat {conflict.seatCode} is taken</div>
            <div className="text-xs text-muted-foreground mt-1">
              Already booked by <span className="text-foreground">{conflict.who}</span> during your window.
            </div>
          </div>
          {conflict.suggestStart >= 0 ? (
            <button
              onClick={() => {
                setStartHour(conflict.suggestStart);
                setEndHour(conflict.suggestEnd);
                const id = conflict.seatId;
                setConflict(null);
                setTimeout(() => book.mutate(id), 50);
              }}
              className="bg-primary text-primary-foreground rounded-md px-3 py-2 text-xs uppercase tracking-[0.3em] neon-glow hover:bg-primary/90"
            >
              Use next free slot · {String(conflict.suggestStart).padStart(2, "0")}:00 → {String(conflict.suggestEnd).padStart(2, "0")}:00
            </button>
          ) : (
            <span className="text-xs text-muted-foreground">No free window left today — try another seat or date.</span>
          )}
          <button onClick={() => setConflict(null)} className="p-1 rounded hover:bg-secondary" aria-label="Dismiss">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="grid sm:grid-cols-3 md:grid-cols-4 gap-3">
        {visible.map((s: any) => {
          const isTaken = taken.has(s.id);
          return (
            <button
              key={s.id}
              disabled={isTaken || book.isPending}
              onClick={() => book.mutate(s.id)}
              className={`card-surface rounded-lg p-4 text-left transition border min-h-36 flex flex-col ${
                isTaken
                  ? "opacity-40 cursor-not-allowed border-border"
                  : "border-primary/30 hover:border-primary hover:shadow-[0_0_20px_rgba(239,68,68,0.3)]"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="font-display text-lg neon-text">{s.code}</div>
                <Armchair className={`w-5 h-5 ${isTaken ? "text-muted-foreground" : "text-primary"}`} />
              </div>
              <div className="text-xs text-muted-foreground mt-1">{s.zone}</div>
              <div className="font-mono text-[10px] uppercase tracking-widest mt-3">
                {isTaken ? <span className="text-destructive">Taken</span> : <span className="text-emerald-400">Available</span>}
              </div>
              <div className={`mt-auto pt-5 text-[10px] uppercase tracking-widest inline-flex items-center gap-1 ${
                isTaken ? "text-muted-foreground" : "text-primary"
              }`}>
                {book.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                {isTaken ? "Reserved" : "Reserve"}
              </div>
            </button>
          );
        })}
        {!visible.length && (
          <div className="col-span-full text-center text-sm text-muted-foreground py-8">No seats configured.</div>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><Calendar className="w-4 h-4 text-primary" /> My Bookings</h2>
        <div className="card-surface rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50">
              <tr className="text-[10px] uppercase tracking-widest text-muted-foreground">
                <th className="text-left px-4 py-3">Seat</th>
                <th className="text-left px-4 py-3">Zone</th>
                <th className="text-left px-4 py-3">When</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {mine?.map((r: any) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-4 py-3 font-mono">{r.seats?.code}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{r.seats?.zone}</td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {new Date(r.start_time).toLocaleString()} → {new Date(r.end_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded ${
                      r.status === "cancelled" ? "bg-muted text-muted-foreground" : "bg-primary/20 text-primary"
                    }`}>{r.status}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {r.status !== "cancelled" && new Date(r.end_time) > new Date() && (
                      <button onClick={() => cancel.mutate(r.id)} className="p-1.5 rounded hover:bg-destructive hover:text-destructive-foreground" aria-label="Cancel">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!mine?.length && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">No bookings yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
