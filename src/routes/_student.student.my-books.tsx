import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { returnBook } from "@/lib/library.functions";
import { toast } from "sonner";
import { Undo2 } from "lucide-react";
import { BookCover } from "@/components/BookCover";

export const Route = createFileRoute("/_student/student/my-books")({
  head: () => ({ meta: [{ title: "My Books — Eclipsesoul" }] }),
  component: MyBooks,
});

function MyBooks() {
  const qc = useQueryClient();
  const { data: loans } = useQuery({
    queryKey: ["my-loans"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      const { data } = await supabase
        .from("transactions")
        .select("*, books(id, title, author, cover_url)")
        .eq("student_id", u.user.id)
        .order("issue_date", { ascending: false });
      return data ?? [];
    },
  });

  const ret = useMutation({
    mutationFn: useServerFn(returnBook),
    onSuccess: (res: any) => {
      toast.success(res?.fine ? `Returned · Fine $${res.fine.toFixed(2)}` : "Returned");
      qc.invalidateQueries({ queryKey: ["my-loans"] });
      qc.invalidateQueries({ queryKey: ["books-all-student"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">My Books</h1>
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground mt-2">Current loans & history</p>
      </div>

      {!loans?.length && (
        <div className="card-surface rounded-lg p-12 text-center text-sm text-muted-foreground">
          You have no loans yet. <Link to="/student/catalog" className="text-primary hover:underline">Find something to read →</Link>
        </div>
      )}

      <div className="grid gap-3">
        {loans?.map((l: any) => {
          const overdue = l.status === "active" && new Date(l.due_date) < new Date();
          return (
            <div key={l.id} className="card-surface rounded-lg p-4 flex items-center gap-4">
              <Link to="/student/catalog/$id" params={{ id: l.books.id }} className="shrink-0">
                <BookCover src={l.books.cover_url} alt={l.books.title} className="w-12 h-16 rounded" />
              </Link>
              <div className="flex-1 min-w-0">
                <Link to="/student/catalog/$id" params={{ id: l.books.id }} className="font-medium hover:text-primary block truncate">{l.books.title}</Link>
                <div className="text-xs text-muted-foreground">{l.books.author}</div>
                <div className="text-[10px] font-mono text-muted-foreground mt-1">
                  Issued {new Date(l.issue_date).toLocaleDateString()} · Due <span className={overdue ? "text-destructive" : ""}>{new Date(l.due_date).toLocaleDateString()}</span>
                  {l.fine_amount > 0 && <span className="text-destructive ml-2">Fine ${Number(l.fine_amount).toFixed(2)}</span>}
                </div>
              </div>
              <span className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded ${
                overdue ? "bg-destructive/20 text-destructive" :
                l.status === "active" ? "bg-primary/20 text-primary" :
                "bg-emerald-500/20 text-emerald-400"
              }`}>{overdue ? "Overdue" : l.status}</span>
              {l.status === "active" && (
                <button onClick={() => ret.mutate({ data: { transaction_id: l.id } } as any)} className="inline-flex items-center gap-1 text-xs px-3 py-1 border border-border rounded hover:bg-primary hover:text-primary-foreground">
                  <Undo2 className="w-3 h-3" /> Return
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
