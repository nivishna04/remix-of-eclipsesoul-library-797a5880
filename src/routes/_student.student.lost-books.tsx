import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertOctagon, Camera, Search, FileText, FileSpreadsheet, CheckCircle2, XCircle, Filter } from "lucide-react";
import { BookCover } from "@/components/BookCover";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { exportPdf, exportExcel } from "@/lib/exports";

export const Route = createFileRoute("/_student/student/lost-books")({
  head: () => ({ meta: [{ title: "Report Lost Book — Eclipsesoul" }] }),
  component: StudentLostBooks,
});

function StudentLostBooks() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [bookId, setBookId] = useState("");
  const [notes, setNotes] = useState("");
  const [scanOpen, setScanOpen] = useState(false);
  const [scanState, setScanState] = useState<{ status: "idle" | "found" | "notfound"; label?: string }>({ status: "idle" });
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");


  const { data: books } = useQuery({
    queryKey: ["lost-book-pick", q],
    queryFn: async () => {
      let query = supabase.from("books").select("id, title, author, cover_url").order("title").limit(30);
      if (q) query = query.or(`title.ilike.%${q}%,author.ilike.%${q}%,isbn.ilike.%${q}%,barcode.ilike.%${q}%`);
      const { data } = await query;
      return data ?? [];
    },
  });

  const { data: reports, isLoading } = useQuery({
    queryKey: ["my-lost-reports"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      const { data } = await supabase
        .from("lost_books")
        .select("*, books(title, author, cover_url)")
        .eq("student_id", u.user.id)
        .order("reported_at", { ascending: false });
      return data ?? [];
    },
  });

  const lookup = async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    const { data } = await supabase
      .from("books")
      .select("id, title")
      .or(`barcode.eq.${trimmed},isbn.eq.${trimmed}`)
      .maybeSingle();
    if (!data) {
      setScanState({ status: "notfound", label: trimmed });
      setBookId("");
      toast.error(`No book found for code "${trimmed}"`);
      return;
    }
    setBookId(data.id);
    setQ(data.title);
    setScanState({ status: "found", label: data.title });
    toast.success(`Matched: ${data.title}`);
  };

  const submit = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      if (!bookId) throw new Error("Pick a book");
      const { error } = await supabase.from("lost_books").insert({
        book_id: bookId,
        student_id: u.user.id,
        notes: notes || null,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Report submitted — a librarian will review.");
      setBookId(""); setNotes(""); setQ(""); setScanState({ status: "idle" });
      qc.invalidateQueries({ queryKey: ["my-lost-reports"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pending = (reports ?? []).filter((r: any) => r.status === "pending").length;
  const resolved = (reports ?? []).filter((r: any) => r.status === "resolved").length;
  const totalFines = (reports ?? []).reduce((s: number, r: any) => s + Number(r.fine_amount ?? 0), 0);

  const filtered = useMemo(() => {
    const list = reports ?? [];
    return list.filter((r: any) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      const d = new Date(r.reported_at);
      if (fromDate && d < new Date(fromDate + "T00:00:00")) return false;
      if (toDate && d > new Date(toDate + "T23:59:59")) return false;
      return true;
    });
  }, [reports, statusFilter, fromDate, toDate]);

  const exportRows = () => filtered.map((r: any) => [
    r.books?.title ?? "—", r.books?.author ?? "—",
    new Date(r.reported_at).toLocaleDateString(), r.status,
    Number(r.fine_amount ?? 0).toFixed(2), r.notes ?? "",
  ]);
  const cols = ["Title", "Author", "Reported", "Status", "Fine ($)", "Notes"];
  const suffix = [
    fromDate || toDate ? `${fromDate || "start"}_to_${toDate || "now"}` : "",
    statusFilter !== "all" ? statusFilter : "",
  ].filter(Boolean).join("_");
  const filename = `lost-books${suffix ? "-" + suffix : ""}`;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight flex items-center gap-3">
            <AlertOctagon className="w-7 h-7 text-primary" /> Report a Lost Book
          </h1>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground mt-2">
            Honesty saves the upside down
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => exportPdf({ title: "My Lost Book Reports", columns: cols, rows: exportRows(), filename, audit: { scope: "student.lost-books", filters: { fromDate, toDate, statusFilter } } })}
            disabled={!filtered.length}
            className="inline-flex items-center gap-1 border border-primary/40 text-primary rounded-md px-3 py-2 text-xs uppercase tracking-[0.3em] hover:bg-primary/10 disabled:opacity-40">
            <FileText className="w-3 h-3" /> PDF
          </button>
          <button
            onClick={() => exportExcel({ sheet: "Lost Books", columns: cols, rows: exportRows(), filename, audit: { scope: "student.lost-books", filters: { fromDate, toDate, statusFilter } } })}
            disabled={!filtered.length}
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


      <div className="grid grid-cols-3 gap-3">
        <div className="card-surface rounded-lg p-4 neon-glow">
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Pending</div>
          <div className="text-2xl font-bold text-primary mt-1">{pending}</div>
        </div>
        <div className="card-surface rounded-lg p-4">
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Resolved</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">{resolved}</div>
        </div>
        <div className="card-surface rounded-lg p-4">
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Total Fines</div>
          <div className="text-2xl font-bold mt-1">${totalFines.toFixed(2)}</div>
        </div>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); submit.mutate(); }}
        className="card-surface rounded-lg p-6 space-y-4 border border-primary/30"
      >
        <div className="text-sm font-semibold flex items-center gap-2">
          <Search className="w-4 h-4 text-primary" /> Submit a New Report
        </div>
        <ol className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground grid sm:grid-cols-3 gap-2">
          <li className="flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-primary/15 text-primary grid place-items-center">1</span> Search or scan the book</li>
          <li className="flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-primary/15 text-primary grid place-items-center">2</span> Add a short note</li>
          <li className="flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-primary/15 text-primary grid place-items-center">3</span> Submit for librarian review</li>
        </ol>
        <div className="grid md:grid-cols-[1fr_auto_auto] gap-3">
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setScanState({ status: "idle" }); }}
            placeholder="Search title, author, ISBN or barcode"
            className="bg-input border border-border rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-primary"
          />
          <button type="button" onClick={() => lookup(q)}
            className="border border-border rounded-md px-3 py-2 text-xs uppercase tracking-[0.3em] hover:bg-secondary">
            Verify code
          </button>
          <button type="button" onClick={() => setScanOpen(true)}
            className="inline-flex items-center gap-1 border border-primary/40 text-primary rounded-md px-3 py-2 text-xs uppercase tracking-[0.3em] hover:bg-primary/10">
            <Camera className="w-3 h-3" /> Scan
          </button>
        </div>
        {scanState.status === "found" && (
          <div className="flex items-center gap-2 text-xs text-emerald-400">
            <CheckCircle2 className="w-3 h-3" /> Matched: <span className="font-medium">{scanState.label}</span>
          </div>
        )}
        {scanState.status === "notfound" && (
          <div className="flex items-center gap-2 text-xs text-destructive">
            <XCircle className="w-3 h-3" /> Book not found for "{scanState.label}". Try the manual select below.
          </div>
        )}
        <select value={bookId} onChange={(e) => setBookId(e.target.value)}
          className="w-full bg-input border border-border rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-primary">
          <option value="">— Select a book manually —</option>
          {books?.map((b: any) => (
            <option key={b.id} value={b.id}>{b.title} · {b.author}</option>
          ))}
        </select>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
          placeholder="What happened? When did you notice it was lost?"
          className="w-full bg-input border border-border rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-primary" />
        <button type="submit" disabled={submit.isPending || !bookId}
          className="w-full bg-primary text-primary-foreground rounded-md py-2.5 text-sm uppercase tracking-[0.3em] neon-glow hover:bg-primary/90 disabled:opacity-50">
          Submit Report
        </button>
      </form>

      <BarcodeScanner open={scanOpen} onClose={() => setScanOpen(false)} onDetected={(t) => { setQ(t); lookup(t); }} />

      <div>
        <h2 className="text-lg font-semibold mb-3">My Reports</h2>
        {isLoading && (
          <div className="card-surface rounded-lg p-8 text-center text-sm text-muted-foreground">Loading…</div>
        )}
        {!isLoading && !reports?.length && (
          <div className="card-surface rounded-lg p-12 text-center text-sm text-muted-foreground">
            No reports yet. If a book goes missing, file a report above.
          </div>
        )}
        <div className="grid md:grid-cols-2 gap-3">
          {reports?.map((r: any) => (
            <div key={r.id} className="card-surface rounded-lg p-4 flex gap-4 border border-border hover:border-primary/40 transition">
              <BookCover src={r.books?.cover_url} alt={r.books?.title ?? ""} className="w-16 h-20 rounded shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{r.books?.title}</div>
                    <div className="text-xs text-muted-foreground truncate">{r.books?.author}</div>
                  </div>
                  <span className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded shrink-0 ${
                    r.status === "resolved" ? "bg-emerald-500/20 text-emerald-400" :
                    r.status === "rejected" ? "bg-muted text-muted-foreground" :
                    "bg-primary/20 text-primary"
                  }`}>{r.status}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="font-mono text-muted-foreground">{new Date(r.reported_at).toLocaleDateString()}</span>
                  <span className="font-mono text-primary">Fine: ${Number(r.fine_amount ?? 0).toFixed(2)}</span>
                </div>
                {r.notes && <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{r.notes}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
