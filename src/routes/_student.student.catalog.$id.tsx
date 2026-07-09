import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { borrowBook, returnBook } from "@/lib/library.functions";
import { ArrowLeft, BookmarkPlus, Loader2, BookMarked, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { BookCover } from "@/components/BookCover";

export const Route = createFileRoute("/_student/student/catalog/$id")({
  head: () => ({ meta: [{ title: "Book — Eclipsesoul" }] }),
  component: StudentBookDetail,
});

function StudentBookDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();

  const { data: book, isLoading } = useQuery({
    queryKey: ["book", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("books").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: myReservation } = useQuery({
    queryKey: ["my-reservation", id],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase
        .from("reservations")
        .select("*")
        .eq("book_id", id)
        .eq("student_id", u.user.id)
        .eq("status", "pending")
        .maybeSingle();
      return data;
    },
  });

  const reserve = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { error } = await supabase.from("reservations").insert({
        book_id: id,
        student_id: u.user.id,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Reservation placed");
      qc.invalidateQueries({ queryKey: ["my-reservation", id] });
      qc.invalidateQueries({ queryKey: ["my-reservations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancel = useMutation({
    mutationFn: async () => {
      if (!myReservation) return;
      const { error } = await supabase
        .from("reservations")
        .update({ status: "cancelled", resolved_at: new Date().toISOString() })
        .eq("id", myReservation.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Reservation cancelled");
      qc.invalidateQueries({ queryKey: ["my-reservation", id] });
      qc.invalidateQueries({ queryKey: ["my-reservations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: myLoan } = useQuery({
    queryKey: ["my-loan", id],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .eq("book_id", id).eq("student_id", u.user.id).eq("status", "active")
        .maybeSingle();
      return data;
    },
  });

  const borrow = useMutation({
    mutationFn: useServerFn(borrowBook),
    onSuccess: () => {
      toast.success("Book borrowed · due in 14 days");
      qc.invalidateQueries({ queryKey: ["book", id] });
      qc.invalidateQueries({ queryKey: ["my-loan", id] });
      qc.invalidateQueries({ queryKey: ["my-loans"] });
      qc.invalidateQueries({ queryKey: ["books-all-student"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const ret = useMutation({
    mutationFn: useServerFn(returnBook),
    onSuccess: (res: any) => {
      toast.success(res?.fine ? `Returned · Fine $${res.fine.toFixed(2)}` : "Returned");
      qc.invalidateQueries({ queryKey: ["book", id] });
      qc.invalidateQueries({ queryKey: ["my-loan", id] });
      qc.invalidateQueries({ queryKey: ["my-loans"] });
      qc.invalidateQueries({ queryKey: ["books-all-student"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="font-mono text-xs text-muted-foreground">Loading...</div>;
  if (!book) return <div>Not found</div>;

  return (
    <div className="space-y-6">
      <Link to="/student/catalog" className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground hover:text-primary">
        <ArrowLeft className="w-3 h-3" /> Back to Catalog
      </Link>

      <div className="grid md:grid-cols-[280px_1fr] gap-8">
        <BookCover src={book.cover_url} alt={book.title} className="aspect-[2/3] rounded-lg neon-glow" />
        <div className="space-y-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">{book.category ?? "Uncatalogued"}</div>
            <h1 className="text-3xl md:text-4xl font-bold mt-2">{book.title}</h1>
            <p className="text-muted-foreground mt-1">by {book.author}</p>
          </div>

          <div className="flex flex-wrap gap-4 text-xs font-mono">
            {book.isbn && <span className="text-muted-foreground">ISBN {book.isbn}</span>}
            {book.publisher && <span className="text-muted-foreground">{book.publisher}</span>}
            {book.published_year && <span className="text-muted-foreground">{book.published_year}</span>}
            {book.shelf_location && <span className="text-muted-foreground">Shelf {book.shelf_location}</span>}
          </div>

          <div className="card-surface rounded-lg p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Availability</div>
              <div className={`text-lg font-mono mt-1 ${book.available_copies > 0 ? "text-primary neon-text" : "text-muted-foreground"}`}>
                {book.available_copies > 0 ? `${book.available_copies} copies on shelf` : "All copies issued"}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {myLoan ? (
                <>
                  <span className="px-3 py-2 text-xs uppercase tracking-widest bg-emerald-500/20 text-emerald-400 rounded-md">Due {new Date(myLoan.due_date).toLocaleDateString()}</span>
                  <button
                    onClick={() => ret.mutate({ data: { transaction_id: myLoan.id } } as any)}
                    disabled={ret.isPending}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm uppercase tracking-widest rounded-md neon-glow hover:bg-primary/90 disabled:opacity-50"
                  >
                    {ret.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Undo2 className="w-3 h-3" />} Return
                  </button>
                </>
              ) : book.available_copies > 0 ? (
                <button
                  onClick={() => borrow.mutate({ data: { book_id: id } } as any)}
                  disabled={borrow.isPending}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground text-sm uppercase tracking-widest rounded-md neon-glow hover:bg-primary/90 disabled:opacity-50"
                >
                  {borrow.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <BookMarked className="w-3 h-3" />}
                  Borrow
                </button>
              ) : myReservation ? (
                <button onClick={() => cancel.mutate()} disabled={cancel.isPending} className="inline-flex items-center gap-2 px-4 py-2 border border-border text-sm uppercase tracking-widest rounded-md hover:bg-secondary">
                  {cancel.isPending && <Loader2 className="w-3 h-3 animate-spin" />} Cancel Hold
                </button>
              ) : (
                <button onClick={() => reserve.mutate()} disabled={reserve.isPending} className="inline-flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground text-sm uppercase tracking-widest rounded-md neon-glow hover:bg-primary/90 disabled:opacity-50">
                  {reserve.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <BookmarkPlus className="w-3 h-3" />} Reserve
                </button>
              )}
            </div>
          </div>

          {book.description && (
            <div className="pt-4 border-t border-border">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Synopsis</div>
              <p className="text-sm leading-relaxed">{book.description}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
