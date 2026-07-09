import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { BookFormDialog } from "@/components/BookFormDialog";
import { BookCover } from "@/components/BookCover";

export const Route = createFileRoute("/_admin/admin/catalog/$id")({
  head: () => ({ meta: [{ title: "Book — Admin" }] }),
  component: AdminBookDetail,
});

function AdminBookDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);

  const { data: book, isLoading } = useQuery({
    queryKey: ["book", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("books").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("books").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Volume removed");
      qc.invalidateQueries({ queryKey: ["books-all"] });
      navigate({ to: "/admin/catalog" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="font-mono text-xs text-muted-foreground">Loading...</div>;
  if (!book) return <div>Not found</div>;

  return (
    <div className="space-y-6">
      <Link to="/admin/catalog" className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground hover:text-primary">
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

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
            <Field label="ISBN" value={book.isbn} />
            <Field label="Barcode" value={book.barcode} />
            <Field label="Publisher" value={book.publisher} />
            <Field label="Year" value={book.published_year} />
            <Field label="Shelf" value={book.shelf_location} />
            <Field label="Stock" value={`${book.available_copies}/${book.quantity}`} />
          </div>

          {book.description && (
            <div className="pt-4 border-t border-border">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Synopsis</div>
              <p className="text-sm leading-relaxed">{book.description}</p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button onClick={() => setEditing(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm uppercase tracking-widest rounded-md neon-glow hover:bg-primary/90">
              <Pencil className="w-3 h-3" /> Edit
            </button>
            <button
              onClick={() => { if (confirm("Remove this book?")) del.mutate(); }}
              className="inline-flex items-center gap-2 px-4 py-2 border border-destructive/40 text-destructive text-sm uppercase tracking-widest rounded-md hover:bg-destructive hover:text-destructive-foreground"
            >
              <Trash2 className="w-3 h-3" /> Delete
            </button>
          </div>
        </div>
      </div>

      <BookFormDialog open={editing} onOpenChange={setEditing} initial={book} />
    </div>
  );
}

function Field({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="font-mono mt-1">{value || "—"}</div>
    </div>
  );
}
