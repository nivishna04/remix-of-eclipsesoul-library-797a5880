import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertCircle, BookmarkPlus, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_student/student/fines")({
  head: () => ({ meta: [{ title: "Fines — Eclipsesoul" }] }),
  component: StudentFines,
});

type Row = {
  id: string;
  source: "overdue" | "lost";
  title: string;
  date: string;
  amount: number;
  status: "active" | "unpaid" | "paid" | "resolved" | "rejected" | "pending" | string;
  agingDays: number;
};

function daysBetween(a: Date, b: Date) {
  return Math.max(0, Math.floor((+b - +a) / 86400000));
}

function StudentFines() {
  const qc = useQueryClient();
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["my-fines"],
    queryFn: async (): Promise<Row[]> => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      const [tx, lost] = await Promise.all([
        supabase
          .from("transactions")
          .select("id, fine_amount, fine_paid, return_date, due_date, status, books(title)")
          .eq("student_id", u.user.id)
          .gt("fine_amount", 0),
        supabase
          .from("lost_books")
          .select("id, fine_amount, reported_at, status, books(title)")
          .eq("student_id", u.user.id)
          .gt("fine_amount", 0),
      ]);
      const now = new Date();
      const a: Row[] = ((tx.data ?? []) as any[]).map((t) => {
        const status = t.fine_paid ? "paid" : t.status === "returned" ? "unpaid" : "active";
        const anchor = new Date(t.due_date);
        const end = status === "paid" || status === "unpaid" ? new Date(t.return_date ?? now) : now;
        return {
          id: t.id,
          source: "overdue",
          title: t.books?.title ?? "—",
          date: t.return_date ?? t.due_date,
          amount: Number(t.fine_amount ?? 0),
          status,
          agingDays: daysBetween(anchor, end),
        };
      });
      const b: Row[] = ((lost.data ?? []) as any[]).map((l) => {
        const status = l.status === "resolved" ? "paid" : (l.status ?? "pending");
        return {
          id: l.id,
          source: "lost",
          title: l.books?.title ?? "—",
          date: l.reported_at,
          amount: Number(l.fine_amount ?? 0),
          status,
          agingDays: daysBetween(new Date(l.reported_at), now),
        };
      });
      return [...a, ...b].sort((x, y) => +new Date(y.date) - +new Date(x.date));
    },
  });

  const rows = data ?? [];
  const isUnpaid = (s: string) => s !== "paid" && s !== "resolved" && s !== "rejected";
  const pending = rows.filter((r) => isUnpaid(r.status)).reduce((s, r) => s + r.amount, 0);
  const paid = rows.filter((r) => r.status === "paid").reduce((s, r) => s + r.amount, 0);
  const total = pending + paid;
  const oldestDays = rows.filter((r) => isUnpaid(r.status)).reduce((m, r) => Math.max(m, r.agingDays), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight flex items-center gap-3">
            <AlertCircle className="w-7 h-7 text-primary" /> Fines
          </h1>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground mt-2">
            Overdue · Lost Book Charges
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { qc.invalidateQueries({ queryKey: ["my-fines"] }); refetch(); }}
            disabled={isFetching}
            className="inline-flex items-center gap-2 border border-border rounded-md px-3 py-2 text-xs uppercase tracking-[0.3em] hover:bg-secondary disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} /> Refresh
          </button>
          <Link to="/student/reservations"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-md px-4 py-2 text-xs uppercase tracking-[0.3em] neon-glow hover:bg-primary/90">
            <BookmarkPlus className="w-4 h-4" /> Reserve a Book
          </Link>
        </div>
      </div>

      {error && (
        <div className="card-surface rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          Couldn't load fines: {(error as Error).message}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card-surface rounded-lg p-4 neon-glow">
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Outstanding</div>
          <div className="text-2xl font-bold text-primary mt-1">${pending.toFixed(2)}</div>
        </div>
        <div className="card-surface rounded-lg p-4">
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Paid</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">${paid.toFixed(2)}</div>
        </div>
        <div className="card-surface rounded-lg p-4">
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Lifetime</div>
          <div className="text-2xl font-bold mt-1">${total.toFixed(2)}</div>
        </div>
        <div className="card-surface rounded-lg p-4">
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Oldest Aging</div>
          <div className={`text-2xl font-bold mt-1 ${oldestDays > 14 ? "text-destructive" : ""}`}>{oldestDays}d</div>
        </div>
      </div>

      <div className="card-surface rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50">
            <tr className="text-[10px] uppercase tracking-widest text-muted-foreground">
              <th className="text-left px-4 py-3">Book</th>
              <th className="text-left px-4 py-3">Type</th>
              <th className="text-left px-4 py-3">Date</th>
              <th className="text-left px-4 py-3">Aging</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-right px-4 py-3">Amount</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>}
            {!isLoading && !rows.length && (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">No fines. Keep it that way.</td></tr>
            )}
            {rows.map((r) => {
              const unpaid = isUnpaid(r.status);
              return (
                <tr key={r.source + r.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{r.title}</td>
                  <td className="px-4 py-3"><span className="text-[10px] uppercase tracking-widest px-2 py-1 rounded bg-secondary">{r.source}</span></td>
                  <td className="px-4 py-3 font-mono text-xs">{new Date(r.date).toLocaleDateString()}</td>
                  <td className={`px-4 py-3 font-mono text-xs ${unpaid && r.agingDays > 14 ? "text-destructive" : unpaid ? "text-primary" : "text-muted-foreground"}`}>
                    {r.agingDays}d {unpaid ? "unpaid" : ""}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span className={`px-2 py-1 rounded uppercase tracking-widest text-[10px] ${
                      r.status === "paid" ? "bg-emerald-500/20 text-emerald-400" :
                      r.status === "active" ? "bg-primary/20 text-primary" :
                      r.status === "unpaid" ? "bg-destructive/20 text-destructive" :
                      "bg-muted text-muted-foreground"
                    }`}>{r.status}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-primary">${r.amount.toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
