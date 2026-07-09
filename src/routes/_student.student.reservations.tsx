import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { X, BookmarkPlus, Camera, CheckCircle2, XCircle } from "lucide-react";
import { BookCover } from "@/components/BookCover";
import { BarcodeScanner } from "@/components/BarcodeScanner";

export const Route = createFileRoute("/_student/student/reservations")({
  head: () => ({ meta: [{ title: "My Reservations" }] }),
  component: MyReservations,
});

function MyReservations() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [bookId, setBookId] = useState("");
  const [scanOpen, setScanOpen] = useState(false);
  const [match, setMatch] = useState<{ status: "idle" | "found" | "notfound"; label?: string }>({ status: "idle" });

  const { data: rows } = useQuery({
    queryKey: ["my-reservations"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      const { data } = await supabase
        .from("reservations")
        .select("*, books(id, title, author, cover_url, available_copies)")
        .eq("student_id", u.user.id)
        .order("reserved_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: books } = useQuery({
    queryKey: ["reservable-books", q],
    queryFn: async () => {
      let query = supabase.from("books").select("id, title, author").order("title").limit(20);
      if (q) query = query.or(`title.ilike.%${q}%,author.ilike.%${q}%,isbn.ilike.%${q}%,barcode.ilike.%${q}%`);
      const { data } = await query;
      return data ?? [];
    },
  });

  const lookup = async (code: string) => {
    const c = code.trim();
    if (!c) return;
    const { data } = await supabase
      .from("books")
      .select("id, title")
      .or(`barcode.eq.${c},isbn.eq.${c}`)
      .maybeSingle();
    if (!data) {
      setMatch({ status: "notfound", label: c });
      setBookId("");
      return toast.error(`No book matches "${c}"`);
    }
    setBookId(data.id);
    setQ(data.title);
    setMatch({ status: "found", label: data.title });
    toast.success(`Selected: ${data.title}`);
  };

  const reserve = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sign in first");
      if (!bookId) throw new Error("Pick a book");
      const { error } = await supabase.from("reservations").insert({
        student_id: u.user.id, book_id: bookId, status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Hold placed");
      setBookId(""); setQ("");
      qc.invalidateQueries({ queryKey: ["my-reservations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("reservations")
        .update({ status: "cancelled", resolved_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cancelled");
      qc.invalidateQueries({ queryKey: ["my-reservations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">My Holds</h1>
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground mt-2">Reserved Titles</p>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); reserve.mutate(); }}
        className="card-surface rounded-lg p-5 space-y-3 neon-glow border border-primary/30"
      >
        <div className="flex items-center gap-2 text-sm font-semibold">
          <BookmarkPlus className="w-4 h-4 text-primary" /> Reserve a Book
        </div>
        <div className="grid md:grid-cols-[1fr_2fr_auto_auto_auto] gap-3">
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setMatch({ status: "idle" }); }}
            placeholder="Title / author / ISBN / barcode"
            className="bg-input border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary"
          />
          <select
            value={bookId}
            onChange={(e) => setBookId(e.target.value)}
            className="bg-input border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary"
          >
            <option value="">— Select a book —</option>
            {books?.map((b) => (
              <option key={b.id} value={b.id}>{b.title} · {b.author}</option>
            ))}
          </select>
          <button type="button" onClick={() => lookup(q)}
            className="border border-border rounded-md px-3 py-2 text-xs uppercase tracking-[0.3em] hover:bg-secondary">
            Verify
          </button>
          <button type="button" onClick={() => setScanOpen(true)}
            className="inline-flex items-center gap-1 border border-primary/40 text-primary rounded-md px-3 py-2 text-xs uppercase tracking-[0.3em] hover:bg-primary/10">
            <Camera className="w-3 h-3" /> Scan
          </button>
          <button type="submit" disabled={reserve.isPending || !bookId}
            className="bg-primary text-primary-foreground rounded-md px-5 py-2 text-xs uppercase tracking-[0.3em] neon-glow hover:bg-primary/90 disabled:opacity-50">
            Reserve
          </button>
        </div>
        {match.status === "found" && (
          <div className="flex items-center gap-2 text-xs text-emerald-400">
            <CheckCircle2 className="w-3 h-3" /> Match: <span className="font-medium">{match.label}</span>
          </div>
        )}
        {match.status === "notfound" && (
          <div className="flex items-center gap-2 text-xs text-destructive">
            <XCircle className="w-3 h-3" /> Book not found for "{match.label}". Try search above or pick from the dropdown.
          </div>
        )}
      </form>

      <BarcodeScanner open={scanOpen} onClose={() => setScanOpen(false)} onDetected={(t) => { setQ(t); lookup(t); }} />

      {!rows?.length && (
        <div className="card-surface rounded-lg p-12 text-center text-sm text-muted-foreground">
          No reservations yet. <Link to="/student/catalog" className="text-primary hover:underline">Browse the catalog →</Link>
        </div>
      )}

      <div className="grid gap-3">
        {rows?.map((r: any) => (
          <div key={r.id} className="card-surface rounded-lg p-4 flex items-center gap-4">
            <Link to="/student/catalog/$id" params={{ id: r.books.id }} className="shrink-0">
              <BookCover src={r.books.cover_url} alt={r.books.title} className="w-12 h-16 rounded" />
            </Link>
            <div className="flex-1 min-w-0">
              <Link to="/student/catalog/$id" params={{ id: r.books.id }} className="font-medium hover:text-primary block truncate">{r.books.title}</Link>
              <div className="text-xs text-muted-foreground">{r.books.author}</div>
              <div className="text-[10px] font-mono text-muted-foreground mt-1">Reserved {new Date(r.reserved_at).toLocaleDateString()}</div>
            </div>
            <span className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded ${
              r.status === "pending" ? "bg-primary/20 text-primary" :
              r.status === "fulfilled" ? "bg-emerald-500/20 text-emerald-400" :
              "bg-muted text-muted-foreground"
            }`}>{r.status}</span>
            {r.status === "pending" && (
              <button onClick={() => cancel.mutate(r.id)} className="p-2 rounded hover:bg-destructive hover:text-destructive-foreground" aria-label="Cancel">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
