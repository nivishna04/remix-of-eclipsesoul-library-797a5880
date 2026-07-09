import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertOctagon, Check, X, FileText, FileSpreadsheet, Filter } from "lucide-react";
import { exportPdf, exportExcel } from "@/lib/exports";

export const Route = createFileRoute("/_admin/admin/lost-books")({
  head: () => ({ meta: [{ title: "Lost Books — Admin" }] }),
  component: AdminLostBooks,
});


function AdminLostBooks() {
  const qc = useQueryClient();
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: items } = useQuery({
    queryKey: ["lost-books-admin"],
    queryFn: async () => {
      const { data } = await supabase
        .from("lost_books")
        .select("*, books(title, author)")
        .order("reported_at", { ascending: false });
      const ids = Array.from(new Set((data ?? []).map((r: any) => r.student_id)));
      const profiles = ids.length
        ? (await supabase.from("profiles").select("id, full_name, email").in("id", ids)).data ?? []
        : [];
      const m = new Map(profiles.map((p: any) => [p.id, p]));
      return (data ?? []).map((r: any) => ({ ...r, profile: m.get(r.student_id) }));
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, fine }: { id: string; status: string; fine?: number }) => {
      const { error } = await supabase
        .from("lost_books")
        .update({ status, ...(fine !== undefined ? { fine_amount: fine } : {}) })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["lost-books-admin"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const list = items ?? [];
    return list.filter((r: any) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      const d = new Date(r.reported_at);
      if (fromDate && d < new Date(fromDate + "T00:00:00")) return false;
      if (toDate && d > new Date(toDate + "T23:59:59")) return false;
      return true;
    });
  }, [items, statusFilter, fromDate, toDate]);

  const exportRows = () => filtered.map((r: any) => [
    r.books?.title ?? "—", r.books?.author ?? "—",
    r.profile?.full_name ?? "—", r.profile?.email ?? "—",
    new Date(r.reported_at).toLocaleDateString(), r.status,
    Number(r.fine_amount ?? 0).toFixed(2), r.notes ?? "",
  ]);
  const cols = ["Title", "Author", "Student", "Email", "Reported", "Status", "Fine ($)", "Notes"];
  const suffix = [
    fromDate || toDate ? `${fromDate || "start"}_to_${toDate || "now"}` : "",
    statusFilter !== "all" ? statusFilter : "",
  ].filter(Boolean).join("_");
  const filename = `admin-lost-books${suffix ? "-" + suffix : ""}`;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight flex items-center gap-3">
            <AlertOctagon className="w-7 h-7 text-primary" /> Lost Book Reports
          </h1>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground mt-2">
            {filtered.length} of {items?.length ?? 0} reports
          </p>
        </div>
        <div className="flex gap-2">
          <button disabled={!filtered.length}
            onClick={() => exportPdf({ title: "Lost Book Reports", columns: cols, rows: exportRows(), filename, audit: { scope: "admin.lost-books", filters: { fromDate, toDate, statusFilter } } })}
            className="inline-flex items-center gap-1 border border-primary/40 text-primary rounded-md px-3 py-2 text-xs uppercase tracking-[0.3em] hover:bg-primary/10 disabled:opacity-40">
            <FileText className="w-3 h-3" /> PDF
          </button>
          <button disabled={!filtered.length}
            onClick={() => exportExcel({ sheet: "Lost Books", columns: cols, rows: exportRows(), filename, audit: { scope: "admin.lost-books", filters: { fromDate, toDate, statusFilter } } })}
            className="inline-flex items-center gap-1 border border-emerald-500/40 text-emerald-400 rounded-md px-3 py-2 text-xs uppercase tracking-[0.3em] hover:bg-emerald-500/10 disabled:opacity-40">
            <FileSpreadsheet className="w-3 h-3" /> Excel
          </button>
        </div>
      </div>

      <div className="card-surface rounded-lg p-4 grid sm:grid-cols-4 gap-3">
        <div className="sm:col-span-1 flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground">
          <Filter className="w-3 h-3 text-primary" /> Export filters
        </div>
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">From</label>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
            className="w-full bg-input border border-border rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-primary" />
        </div>
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">To</label>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
            className="w-full bg-input border border-border rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-primary" />
        </div>
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Status</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full bg-input border border-border rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-primary">
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="resolved">Resolved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>



      <div className="card-surface rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50">
            <tr className="text-[10px] uppercase tracking-widest text-muted-foreground">
              <th className="text-left px-4 py-3">Book</th>
              <th className="text-left px-4 py-3">Student</th>
              <th className="text-left px-4 py-3">Reported</th>
              <th className="text-left px-4 py-3">Notes</th>
              <th className="text-left px-4 py-3">Fine</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-right px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r: any) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-4 py-3">
                  <div className="font-medium">{r.books?.title}</div>
                  <div className="text-xs text-muted-foreground">{r.books?.author}</div>
                </td>
                <td className="px-4 py-3">
                  <div>{r.profile?.full_name ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">{r.profile?.email}</div>
                </td>
                <td className="px-4 py-3 font-mono text-xs">{new Date(r.reported_at).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-xs max-w-xs truncate">{r.notes || "—"}</td>
                <td className="px-4 py-3 font-mono text-xs">
                  <input
                    type="number"
                    defaultValue={Number(r.fine_amount ?? 0)}
                    onBlur={(e) =>
                      updateStatus.mutate({ id: r.id, status: r.status, fine: Number(e.target.value) })
                    }
                    className="w-20 bg-input border border-border rounded px-2 py-1"
                  />
                </td>
                <td className="px-4 py-3">
                  <span className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded ${
                    r.status === "resolved" ? "bg-emerald-500/20 text-emerald-400" :
                    r.status === "rejected" ? "bg-muted text-muted-foreground" :
                    "bg-primary/20 text-primary"
                  }`}>{r.status}</span>
                </td>
                <td className="px-4 py-3 text-right space-x-2">
                  {r.status === "pending" && (
                    <>
                      <button onClick={() => updateStatus.mutate({ id: r.id, status: "resolved" })}
                        className="inline-flex items-center gap-1 text-xs px-2 py-1 border border-border rounded hover:bg-emerald-500/20 hover:text-emerald-400">
                        <Check className="w-3 h-3" /> Resolve
                      </button>
                      <button onClick={() => updateStatus.mutate({ id: r.id, status: "rejected" })}
                        className="inline-flex items-center gap-1 text-xs px-2 py-1 border border-border rounded hover:bg-destructive/20 hover:text-destructive">
                        <X className="w-3 h-3" /> Reject
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">No lost reports.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
