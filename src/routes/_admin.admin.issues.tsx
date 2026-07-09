import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { borrowBook, returnBook } from "@/lib/library.functions";
import { toast } from "sonner";
import { Undo2, ScanLine, Plus, Camera, CheckCircle2, XCircle } from "lucide-react";
import { BarcodeScanner } from "@/components/BarcodeScanner";

export const Route = createFileRoute("/_admin/admin/issues")({
  head: () => ({ meta: [{ title: "Active Loans — Admin" }] }),
  component: AdminIssues,
});

function AdminIssues() {
  const qc = useQueryClient();
  const scanRef = useRef<HTMLInputElement>(null);
  const [barcode, setBarcode] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [days, setDays] = useState(14);
  const [scanOpen, setScanOpen] = useState(false);
  const [match, setMatch] = useState<{ status: "idle" | "found" | "notfound" | "multi"; label?: string; bookId?: string }>({ status: "idle" });
  const [candidates, setCandidates] = useState<Array<{ id: string; title: string; author: string | null; barcode: string | null; isbn: string | null }>>([]);

  useEffect(() => { scanRef.current?.focus(); }, []);

  const { data: loans } = useQuery({
    queryKey: ["active-loans"],
    queryFn: async () => {
      const { data } = await supabase
        .from("transactions")
        .select("*, books(title, author, barcode)")
        .order("issue_date", { ascending: false });
      const ids = Array.from(new Set((data ?? []).map((r: any) => r.student_id)));
      const profiles = ids.length
        ? (await supabase.from("profiles").select("id, full_name, email").in("id", ids)).data ?? []
        : [];
      const map = new Map(profiles.map((p: any) => [p.id, p]));
      return (data ?? []).map((r: any) => ({ ...r, profile: map.get(r.student_id) }));
    },
  });

  const borrow = useMutation({
    mutationFn: useServerFn(borrowBook),
    onSuccess: () => {
      toast.success("Issued");
      setBarcode(""); setStudentEmail(""); setMatch({ status: "idle" }); setCandidates([]);
      qc.invalidateQueries({ queryKey: ["active-loans"] });
      qc.invalidateQueries({ queryKey: ["books-all"] });
      scanRef.current?.focus();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const ret = useMutation({
    mutationFn: useServerFn(returnBook),
    onSuccess: (res: any) => {
      toast.success(res?.fine ? `Returned · Fine $${res.fine.toFixed(2)}` : "Returned");
      qc.invalidateQueries({ queryKey: ["active-loans"] });
      qc.invalidateQueries({ queryKey: ["books-all"] });
      qc.invalidateQueries({ queryKey: ["my-loans"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const verify = async (code: string) => {
    const c = code.trim();
    if (!c) { setMatch({ status: "idle" }); setCandidates([]); return null; }
    // Exact match first
    const { data: exact } = await supabase
      .from("books")
      .select("id, title, author, barcode, isbn")
      .or(`barcode.eq.${c},isbn.eq.${c}`)
      .limit(5);
    if (exact && exact.length === 1) {
      setMatch({ status: "found", label: exact[0].title, bookId: exact[0].id });
      setCandidates([]);
      return exact[0];
    }
    if (exact && exact.length > 1) {
      setCandidates(exact as any);
      setMatch({ status: "multi", label: c });
      toast.message(`${exact.length} books matched "${c}" — pick the right one`);
      return null;
    }
    // Fuzzy: maybe a partial scan
    const { data: fuzzy } = await supabase
      .from("books")
      .select("id, title, author, barcode, isbn")
      .or(`barcode.ilike.%${c}%,isbn.ilike.%${c}%`)
      .limit(10);
    if (fuzzy && fuzzy.length === 1) {
      setMatch({ status: "found", label: fuzzy[0].title, bookId: fuzzy[0].id });
      setCandidates([]);
      return fuzzy[0];
    }
    if (fuzzy && fuzzy.length > 1) {
      setCandidates(fuzzy as any);
      setMatch({ status: "multi", label: c });
      toast.message(`${fuzzy.length} possible matches for "${c}" — choose or rescan`);
      return null;
    }
    setMatch({ status: "notfound", label: c });
    setCandidates([]);
    return null;
  };

  const pickCandidate = (id: string) => {
    const b = candidates.find((x) => x.id === id);
    if (!b) return;
    setMatch({ status: "found", label: b.title, bookId: b.id });
    setBarcode(b.barcode || b.isbn || b.title);
    setCandidates([]);
  };

  const doIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentEmail.trim()) return toast.error("Enter student email");
    let bookId = match.status === "found" ? match.bookId : undefined;
    if (!bookId) {
      if (!barcode.trim()) return toast.error("Scan or enter a barcode/ISBN");
      const book = await verify(barcode);
      if (!book) return; // multi or notfound — UI shows next step
      bookId = book.id;
    }

    const { data: prof } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", studentEmail.trim().toLowerCase())
      .maybeSingle();
    if (!prof) return toast.error("Student not found");

    borrow.mutate({ data: { book_id: bookId, student_id: prof.id, days } } as any);
  };


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Issues</h1>
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground mt-2">
          {loans?.filter((l) => l.status === "active").length ?? 0} Active · {loans?.length ?? 0} Total
        </p>
      </div>

      <form onSubmit={doIssue} className="card-surface rounded-lg p-5 space-y-3 neon-glow">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <ScanLine className="w-4 h-4 text-primary" /> Scan & Issue
          <span className="ml-auto text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Click in the barcode field & scan
          </span>
        </div>
        <div className="grid md:grid-cols-[2fr_2fr_auto_auto_auto_auto] gap-3">
          <input
            ref={scanRef}
            value={barcode}
            onChange={(e) => { setBarcode(e.target.value); setMatch({ status: "idle" }); }}
            placeholder="Barcode or ISBN (or type manually)"
            className="bg-input border border-primary/40 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary"
          />
          <input
            value={studentEmail}
            onChange={(e) => setStudentEmail(e.target.value)}
            placeholder="Student email"
            type="email"
            className="bg-input border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary"
          />
          <button type="button" onClick={() => verify(barcode)}
            className="border border-border rounded-md px-3 py-2 text-xs uppercase tracking-[0.3em] hover:bg-secondary">
            Verify
          </button>
          <input
            type="number" min={1} max={60}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="w-20 bg-input border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary"
            aria-label="Days"
          />
          <button type="button" onClick={() => setScanOpen(true)}
            className="inline-flex items-center gap-1 border border-primary/40 text-primary rounded-md px-3 py-2 text-xs uppercase tracking-[0.3em] hover:bg-primary/10">
            <Camera className="w-3 h-3" /> Scan
          </button>
          <button type="submit" disabled={borrow.isPending}
            className="inline-flex items-center gap-1 bg-primary text-primary-foreground rounded-md px-4 py-2 text-xs uppercase tracking-[0.3em] hover:bg-primary/90 disabled:opacity-50">
            <Plus className="w-3 h-3" /> Issue
          </button>
        </div>
        {match.status === "found" && (
          <div className="flex items-center gap-2 text-xs text-emerald-400">
            <CheckCircle2 className="w-3 h-3" /> Match: <span className="font-medium">{match.label}</span>
          </div>
        )}
        {match.status === "notfound" && (
          <div className="flex items-center gap-2 text-xs text-destructive">
            <XCircle className="w-3 h-3" /> No book found for "{match.label}". Check the ISBN or scan again.
          </div>
        )}
        {match.status === "multi" && (
          <div className="space-y-2 border border-amber-500/40 bg-amber-500/5 rounded-md p-3">
            <div className="text-xs text-amber-400 font-mono uppercase tracking-widest">
              {candidates.length} possible matches for "{match.label}" — pick one or rescan
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              {candidates.map((c) => (
                <button key={c.id} type="button" onClick={() => pickCandidate(c.id)}
                  className="text-left text-xs border border-border rounded p-2 hover:border-primary hover:bg-primary/5">
                  <div className="font-medium truncate">{c.title}</div>
                  <div className="text-muted-foreground truncate">{c.author}</div>
                  <div className="font-mono text-[10px] text-muted-foreground mt-1">ISBN {c.isbn ?? "—"} · BC {c.barcode ?? "—"}</div>
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setScanOpen(true)}
                className="inline-flex items-center gap-1 text-xs px-2 py-1 border border-primary/40 text-primary rounded hover:bg-primary/10">
                <Camera className="w-3 h-3" /> Rescan
              </button>
              <button type="button" onClick={() => { setMatch({ status: "idle" }); setCandidates([]); setBarcode(""); scanRef.current?.focus(); }}
                className="text-xs px-2 py-1 border border-border rounded hover:bg-secondary">
                Clear
              </button>
            </div>
          </div>
        )}
      </form>
      <BarcodeScanner open={scanOpen} onClose={() => setScanOpen(false)} onDetected={(t) => { setBarcode(t); verify(t); scanRef.current?.focus(); }} />


      <div className="card-surface rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50">
            <tr className="text-[10px] uppercase tracking-widest text-muted-foreground">
              <th className="text-left px-4 py-3">Book</th>
              <th className="text-left px-4 py-3">Student</th>
              <th className="text-left px-4 py-3">Issued</th>
              <th className="text-left px-4 py-3">Due</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-right px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {loans?.map((l: any) => {
              const overdue = l.status === "active" && new Date(l.due_date) < new Date();
              return (
                <tr key={l.id} className="border-t border-border">
                  <td className="px-4 py-3"><div className="font-medium">{l.books?.title}</div><div className="text-xs text-muted-foreground">{l.books?.author}</div></td>
                  <td className="px-4 py-3"><div>{l.profile?.full_name ?? "—"}</div><div className="text-xs text-muted-foreground">{l.profile?.email}</div></td>
                  <td className="px-4 py-3 font-mono text-xs">{new Date(l.issue_date).toLocaleDateString()}</td>
                  <td className={`px-4 py-3 font-mono text-xs ${overdue ? "text-destructive" : ""}`}>{new Date(l.due_date).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded ${
                      overdue ? "bg-destructive/20 text-destructive" :
                      l.status === "active" ? "bg-primary/20 text-primary" :
                      "bg-emerald-500/20 text-emerald-400"
                    }`}>{overdue ? "Overdue" : l.status}</span>
                    {l.fine_amount > 0 && <span className="ml-2 text-xs font-mono text-destructive">${Number(l.fine_amount).toFixed(2)}</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {l.status === "active" && (
                      <button onClick={() => ret.mutate({ data: { transaction_id: l.id } } as any)} className="inline-flex items-center gap-1 text-xs px-3 py-1 border border-border rounded hover:bg-primary hover:text-primary-foreground">
                        <Undo2 className="w-3 h-3" /> Return
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {!loans?.length && (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">No loans on record.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
