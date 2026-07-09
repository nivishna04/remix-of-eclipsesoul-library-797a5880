import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, RefreshCw, Search } from "lucide-react";

export const Route = createFileRoute("/_admin/admin/fines")({
  head: () => ({ meta: [{ title: "Fines — Eclipsesoul" }] }),
  component: AdminFines,
});

type Row = {
  key: string;
  id: string;
  source: "overdue" | "lost";
  studentId: string;
  studentName: string;
  studentEmail: string;
  bookTitle: string;
  date: string;
  amount: number;
  paid: boolean;
  status: string;
  agingDays: number;
};

function daysBetween(a: Date, b: Date) {
  return Math.max(0, Math.floor((+b - +a) / 86400000));
}

function AdminFines() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "unpaid" | "paid">("unpaid");

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["admin-fines"],
    queryFn: async (): Promise<Row[]> => {
      const [tx, lost, profs] = await Promise.all([
        supabase
          .from("transactions")
          .select("id, student_id, fine_amount, fine_paid, return_date, due_date, status, books(title)")
          .gt("fine_amount", 0),
        supabase
          .from("lost_books")
          .select("id, student_id, fine_amount, reported_at, status, books(title)")
          .gt("fine_amount", 0),
        supabase.from("profiles").select("id, full_name, email"),
      ]);
      const pmap = new Map<string, { name: string; email: string }>();
      (profs.data ?? []).forEach((p: any) =>
        pmap.set(p.id, { name: p.full_name ?? "", email: p.email ?? "" }),
      );
      const now = new Date();
      const a: Row[] = ((tx.data ?? []) as any[]).map((t) => {
        const paid = !!t.fine_paid;
        const anchor = new Date(t.due_date);
        const end = t.return_date ? new Date(t.return_date) : now;
        const p = pmap.get(t.student_id) ?? { name: "", email: "" };
        return {
          key: "tx:" + t.id,
          id: t.id,
          source: "overdue",
          studentId: t.student_id,
          studentName: p.name,
          studentEmail: p.email,
          bookTitle: t.books?.title ?? "—",
          date: t.return_date ?? t.due_date,
          amount: Number(t.fine_amount ?? 0),
          paid,
          status: paid ? "paid" : t.status === "returned" ? "unpaid" : "active",
          agingDays: daysBetween(anchor, paid ? end : now),
        };
      });
      const b: Row[] = ((lost.data ?? []) as any[]).map((l) => {
        const paid = l.status === "resolved";
        const p = pmap.get(l.student_id) ?? { name: "", email: "" };
        return {
          key: "lost:" + l.id,
          id: l.id,
          source: "lost",
          studentId: l.student_id,
          studentName: p.name,
          studentEmail: p.email,
          bookTitle: l.books?.title ?? "—",
          date: l.reported_at,
          amount: Number(l.fine_amount ?? 0),
          paid,
          status: l.status ?? "pending",
          agingDays: daysBetween(new Date(l.reported_at), now),
        };
      });
      return [...a, ...b].sort((x, y) => +new Date(y.date) - +new Date(x.date));
    },
  });

  const markPaid = useMutation({
    mutationFn: async (r: Row) => {
      if (r.source === "overdue") {
        const { error } = await supabase
          .from("transactions")
          .update({ fine_paid: true })
          .eq("id", r.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("lost_books")
          .update({ status: "resolved" })
          .eq("id", r.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Marked as paid");
      qc.invalidateQueries({ queryKey: ["admin-fines"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = (data ?? []).filter((r) => {
    if (filter === "unpaid" && r.paid) return false;
    if (filter === "paid" && !r.paid) return false;
    if (q) {
      const s = q.toLowerCase();
      return (
        r.studentName.toLowerCase().includes(s) ||
        r.studentEmail.toLowerCase().includes(s) ||
        r.bookTitle.toLowerCase().includes(s)
      );
    }
    return true;
  });

  const outstanding = (data ?? []).filter((r) => !r.paid).reduce((s, r) => s + r.amount, 0);
  const collected = (data ?? []).filter((r) => r.paid).reduce((s, r) => s + r.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight flex items-center gap-3">
            <AlertCircle className="w-7 h-7 text-primary" /> Fines
          </h1>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground mt-2">
            Fine Management
          </p>
        </div>
        <button
          onClick={() => { qc.invalidateQueries({ queryKey: ["admin-fines"] }); refetch(); }}
          disabled={isFetching}
          className="inline-flex items-center gap-2 border border-border rounded-md px-3 py-2 text-xs uppercase tracking-[0.3em] hover:bg-secondary disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {error && (
        <div className="card-surface rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          Couldn't load fines: {(error as Error).message}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="card-surface rounded-lg p-4 neon-glow">
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Outstanding</div>
          <div className="text-2xl font-bold text-primary mt-1">${outstanding.toFixed(2)}</div>
        </div>
        <div className="card-surface rounded-lg p-4">
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Collected</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">${collected.toFixed(2)}</div>
        </div>
        <div className="card-surface rounded-lg p-4">
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Entries</div>
          <div className="text-2xl font-bold mt-1">{data?.length ?? 0}</div>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search student or book…"
            className="w-full bg-input border border-border rounded-md pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-primary"
          />
        </div>
        <div className="flex gap-1 rounded-md border border-border p-1">
          {(["unpaid", "paid", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-[10px] uppercase tracking-widest rounded ${
                filter === f ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="card-surface rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50">
            <tr className="text-[10px] uppercase tracking-widest text-muted-foreground">
              <th className="text-left px-4 py-3">Student</th>
              <th className="text-left px-4 py-3">Book</th>
              <th className="text-left px-4 py-3">Type</th>
              <th className="text-left px-4 py-3">Date</th>
              <th className="text-left px-4 py-3">Aging</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-right px-4 py-3">Amount</th>
              <th className="text-right px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
            )}
            {!isLoading && !rows.length && (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-muted-foreground">No fines found.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.key} className="border-t border-border">
                <td className="px-4 py-3">
                  <div className="font-medium">{r.studentName || "—"}</div>
                  <div className="text-xs text-muted-foreground">{r.studentEmail}</div>
                </td>
                <td className="px-4 py-3">{r.bookTitle}</td>
                <td className="px-4 py-3">
                  <span className="text-[10px] uppercase tracking-widest px-2 py-1 rounded bg-secondary">{r.source}</span>
                </td>
                <td className="px-4 py-3 font-mono text-xs">{new Date(r.date).toLocaleDateString()}</td>
                <td className={`px-4 py-3 font-mono text-xs ${!r.paid && r.agingDays > 14 ? "text-destructive" : !r.paid ? "text-primary" : "text-muted-foreground"}`}>
                  {r.agingDays}d
                </td>
                <td className="px-4 py-3 text-xs">
                  <span className={`px-2 py-1 rounded uppercase tracking-widest text-[10px] ${
                    r.paid ? "bg-emerald-500/20 text-emerald-400" :
                    r.status === "active" ? "bg-primary/20 text-primary" :
                    "bg-destructive/20 text-destructive"
                  }`}>{r.status}</span>
                </td>
                <td className="px-4 py-3 text-right font-mono text-primary">${r.amount.toFixed(2)}</td>
                <td className="px-4 py-3 text-right">
                  {!r.paid && (
                    <button
                      onClick={() => markPaid.mutate(r)}
                      disabled={markPaid.isPending}
                      className="inline-flex items-center gap-1 bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-[10px] uppercase tracking-widest neon-glow hover:bg-primary/90 disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-3 h-3" /> Mark Paid
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
