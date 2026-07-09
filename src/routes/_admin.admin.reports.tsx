import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { exportPdf, exportExcel } from "@/lib/exports";
import { FileDown, FileSpreadsheet, FileText, BookOpen, Users, ClipboardList, AlertOctagon, TrendingUp, Undo2, History } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, Legend } from "recharts";

export const Route = createFileRoute("/_admin/admin/reports")({
  head: () => ({ meta: [{ title: "Reports — Eclipsesoul" }] }),
  component: Reports,
});

const TABS = [
  { key: "books", label: "Books", icon: BookOpen },
  { key: "students", label: "Students", icon: Users },
  { key: "issued", label: "Issued", icon: ClipboardList },
  { key: "overdue", label: "Overdue", icon: AlertOctagon },
  { key: "returned", label: "Returned", icon: Undo2 },
  { key: "trends", label: "Trends", icon: TrendingUp },
  { key: "audit", label: "Audit", icon: History },
] as const;

type TabKey = typeof TABS[number]["key"];

const RED_PALETTE = ["#ef4444", "#dc2626", "#b91c1c", "#7f1d1d", "#fca5a5", "#f87171", "#991b1b", "#450a0a"];

function Reports() {
  const [tab, setTab] = useState<TabKey>("books");
  const qc = useQueryClient();


  const { data: stats } = useQuery({
    queryKey: ["reports-stats"],
    queryFn: async () => {
      const [books, tx, students, lost] = await Promise.all([
        supabase.from("books").select("title, category, quantity, available_copies, author, isbn, shelf_location"),
        supabase.from("transactions").select("id, status, due_date, return_date, issue_date, fine_amount, book_id, student_id, books(title)"),
        supabase.from("profiles").select("id, full_name, email, student_code, department, year, created_at"),
        supabase.from("lost_books").select("id, status, fine_amount, reported_at"),
      ]);
      return { books: books.data ?? [], tx: tx.data ?? [], students: students.data ?? [], lost: lost.data ?? [] };
    },
  });

  const totalTitles = stats?.books.length ?? 0;
  const totalCopies = stats?.books.reduce((s, b) => s + (b.quantity ?? 0), 0) ?? 0;
  const available = stats?.books.reduce((s, b) => s + (b.available_copies ?? 0), 0) ?? 0;
  const issued = stats?.tx.filter((t: any) => t.status === "active").length ?? 0;
  const overdueRows = (stats?.tx ?? []).filter((t: any) => t.status === "active" && new Date(t.due_date) < new Date());
  const returnedRows = (stats?.tx ?? []).filter((t: any) => t.status === "returned");

  const genreData = (() => {
    const m = new Map<string, number>();
    (stats?.books ?? []).forEach((b: any) => {
      const k = b.category || "Uncategorized";
      m.set(k, (m.get(k) ?? 0) + 1);
    });
    return Array.from(m.entries()).map(([name, value]) => ({ name, value }));
  })();

  const topBorrowed = (() => {
    const m = new Map<string, { title: string; count: number }>();
    (stats?.tx ?? []).forEach((t: any) => {
      const k = t.book_id;
      const title = t.books?.title ?? "—";
      const prev = m.get(k);
      m.set(k, { title, count: (prev?.count ?? 0) + 1 });
    });
    return Array.from(m.values()).sort((a, b) => b.count - a.count).slice(0, 6);
  })();

  const buildRows = (): { columns: string[]; rows: (string | number)[][]; title: string } => {
    switch (tab) {
      case "books":
        return {
          title: "Book Catalog",
          columns: ["Title", "Author", "ISBN", "Category", "Total", "Available", "Shelf"],
          rows: (stats?.books ?? []).map((b: any) => [b.title, b.author, b.isbn ?? "", b.category ?? "", b.quantity ?? 0, b.available_copies ?? 0, b.shelf_location ?? ""]),
        };
      case "students":
        return {
          title: "Students",
          columns: ["Name", "Email", "Code", "Department", "Year", "Joined"],
          rows: (stats?.students ?? []).map((s: any) => [s.full_name ?? "", s.email ?? "", s.student_code ?? "", s.department ?? "", s.year ?? "", s.created_at ? new Date(s.created_at).toLocaleDateString() : ""]),
        };
      case "issued":
        return {
          title: "Currently Issued",
          columns: ["Book", "Issued", "Due", "Fine"],
          rows: (stats?.tx ?? []).filter((t: any) => t.status === "active").map((t: any) => [t.books?.title ?? "—", new Date(t.issue_date).toLocaleDateString(), new Date(t.due_date).toLocaleDateString(), Number(t.fine_amount ?? 0).toFixed(2)]),
        };
      case "overdue":
        return {
          title: "Overdue Loans",
          columns: ["Book", "Issued", "Due", "Days Late"],
          rows: overdueRows.map((t: any) => [t.books?.title ?? "—", new Date(t.issue_date).toLocaleDateString(), new Date(t.due_date).toLocaleDateString(), Math.ceil((Date.now() - +new Date(t.due_date)) / 86400000)]),
        };
      case "returned":
        return {
          title: "Returned Loans",
          columns: ["Book", "Issued", "Returned", "Fine"],
          rows: returnedRows.map((t: any) => [t.books?.title ?? "—", new Date(t.issue_date).toLocaleDateString(), t.return_date ? new Date(t.return_date).toLocaleDateString() : "—", Number(t.fine_amount ?? 0).toFixed(2)]),
        };
      case "trends":
        return {
          title: "Genre Distribution",
          columns: ["Genre", "Titles"],
          rows: genreData.map((g) => [g.name, g.value]),
        };
      case "audit":
        return { title: "Audit Trail", columns: [], rows: [] };
    }
  };

  const exportNow = async (fmt: "pdf" | "xlsx") => {
    const { title, columns, rows } = buildRows();
    if (!columns.length) return;
    const fn = `eclipsesoul-${tab}-${new Date().toISOString().slice(0, 10)}`;
    const subtitle = `Generated ${new Date().toLocaleString()} · ${rows.length} rows`;
    const audit = { scope: tab, filters: {} };
    if (fmt === "pdf") await exportPdf({ title, subtitle, columns, rows, filename: fn, audit });
    else await exportExcel({ sheet: title, columns, rows, filename: fn, audit });
    qc.invalidateQueries({ queryKey: ["audit-trail"] });
  };

  const { data: audit } = useQuery({
    queryKey: ["audit-trail"],
    queryFn: async () => {
      const { data } = await supabase
        .from("activity_logs")
        .select("id, action, entity, entity_id, metadata, created_at, user_id")
        .like("action", "export.%")
        .order("created_at", { ascending: false })
        .limit(100);
      const ids = Array.from(new Set((data ?? []).map((r: any) => r.user_id).filter(Boolean)));
      const profiles = ids.length
        ? (await supabase.from("profiles").select("id, full_name, email").in("id", ids)).data ?? []
        : [];
      const m = new Map(profiles.map((p: any) => [p.id, p]));
      return (data ?? []).map((r: any) => ({ ...r, profile: m.get(r.user_id) }));
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground mt-2">Analytics, statistics, and export tools for library operations</p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm transition ${
              tab === key
                ? "bg-primary/15 text-primary neon-border"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {/* Export */}
      <div className="flex justify-end gap-2">
        <button onClick={() => exportNow("pdf")}
          className="inline-flex items-center gap-2 text-xs px-4 py-2 border border-border rounded hover:bg-primary hover:text-primary-foreground">
          <FileText className="w-3 h-3" /> Export PDF
        </button>
        <button onClick={() => exportNow("xlsx")}
          className="inline-flex items-center gap-2 text-xs px-4 py-2 border border-border rounded hover:bg-emerald-500 hover:text-white">
          <FileSpreadsheet className="w-3 h-3" /> Export Excel
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { l: "Total Titles", v: totalTitles },
          { l: "Total Copies", v: totalCopies },
          { l: "Available", v: available },
          { l: "Issued", v: issued },
        ].map((c) => (
          <div key={c.l} className="card-surface rounded-lg p-6 text-center neon-glow">
            <div className="text-4xl font-bold text-primary">{c.v}</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground mt-2">{c.l}</div>
          </div>
        ))}
      </div>

      {tab === "audit" ? (
        <div className="card-surface rounded-lg overflow-hidden">
          <div className="flex items-center gap-2 p-4 border-b border-border">
            <History className="w-4 h-4 text-primary" />
            <h3 className="font-semibold">Export Audit Trail</h3>
            <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {audit?.length ?? 0} events
            </span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-secondary/50">
              <tr className="text-[10px] uppercase tracking-widest text-muted-foreground">
                <th className="text-left px-4 py-3">When</th>
                <th className="text-left px-4 py-3">User</th>
                <th className="text-left px-4 py-3">Format</th>
                <th className="text-left px-4 py-3">Scope</th>
                <th className="text-right px-4 py-3">Rows</th>
              </tr>
            </thead>
            <tbody>
              {(audit ?? []).map((r: any) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-4 py-3 font-mono text-xs">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3 text-xs">{r.profile?.full_name ?? r.profile?.email ?? r.user_id?.slice(0, 8) ?? "—"}</td>
                  <td className="px-4 py-3"><span className="text-[10px] uppercase tracking-widest px-2 py-1 rounded bg-primary/15 text-primary">{r.action?.replace("export.", "")}</span></td>
                  <td className="px-4 py-3 text-xs">{r.entity_id ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs">{r.metadata?.rows ?? 0}</td>
                </tr>
              ))}
              {!audit?.length && (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">No exports yet — generate one and it shows up here.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      ) : tab === "books" || tab === "trends" ? (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="card-surface rounded-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-primary" />
              <h3 className="font-semibold">Genre Distribution</h3>
            </div>
            <div className="h-72">
              {genreData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={genreData} dataKey="value" nameKey="name" outerRadius={100} label={(e: any) => `${e.name} ${((e.percent ?? 0) * 100).toFixed(0)}%`}>
                      {genreData.map((_, i) => <Cell key={i} fill={RED_PALETTE[i % RED_PALETTE.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "#0a0a0a", border: "1px solid #ef4444" }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <div className="grid place-items-center h-full text-sm text-muted-foreground">No data yet</div>}
            </div>
          </div>

          <div className="card-surface rounded-lg p-6">
            <h3 className="font-semibold mb-4">Most Borrowed Books</h3>
            {topBorrowed.length ? (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topBorrowed} layout="vertical" margin={{ left: 40 }}>
                    <XAxis type="number" stroke="#666" fontSize={10} />
                    <YAxis type="category" dataKey="title" stroke="#666" fontSize={10} width={140} />
                    <Tooltip contentStyle={{ background: "#0a0a0a", border: "1px solid #ef4444" }} />
                    <Legend />
                    <Bar dataKey="count" fill="#ef4444" name="Loans" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="grid place-items-center h-72 text-sm text-muted-foreground">No issue data yet</div>
            )}
          </div>
        </div>
      ) : (
        <div className="card-surface rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50">
              <tr className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {buildRows().columns.map((c) => <th key={c} className="text-left px-4 py-3">{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {buildRows().rows.map((r, i) => (
                <tr key={i} className="border-t border-border">
                  {r.map((c, j) => <td key={j} className="px-4 py-3">{c}</td>)}
                </tr>
              ))}
              {!buildRows().rows.length && (
                <tr><td colSpan={buildRows().columns.length} className="px-4 py-12 text-center text-muted-foreground">No rows.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
