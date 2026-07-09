import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { BookFormDialog } from "@/components/BookFormDialog";
import { BookCover } from "@/components/BookCover";

export const Route = createFileRoute("/_admin/admin/catalog/")({
  head: () => ({ meta: [{ title: "Catalog — Admin" }] }),
  component: AdminCatalog,
});

function AdminCatalog() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const qc = useQueryClient();

  const { data: books } = useQuery({
    queryKey: ["books-all"],
    queryFn: async () => {
      const { data } = await supabase.from("books").select("*").order("title");
      return data ?? [];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("books").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Volume removed");
      qc.invalidateQueries({ queryKey: ["books-all"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = books?.filter(
    (b) =>
      !q ||
      [b.title, b.author, b.isbn, b.barcode, b.category].some((f) =>
        f?.toLowerCase().includes(q.toLowerCase()),
      ),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Catalog</h1>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground mt-2">
            {books?.length ?? 0} Titles · Manage Inventory
          </p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm uppercase tracking-widest rounded-md neon-glow hover:bg-primary/90"
        >
          <Plus className="w-4 h-4" /> Add Book
        </button>
      </div>

      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by title, author, ISBN, barcode..."
          className="w-full pl-9 pr-3 py-2 bg-input border border-border rounded-md text-sm focus:outline-none focus:border-primary"
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        {filtered?.map((b) => (
          <div key={b.id} className="card-surface card-hover hover:card-hover-on rounded-lg p-3 group relative">
            <Link
              to="/admin/catalog/$id"
              params={{ id: b.id }}
              className="block"
            >
              <BookCover src={b.cover_url} alt={b.title} className="aspect-[2/3] rounded mb-3" />
              <div className="text-xs font-medium line-clamp-2 group-hover:text-primary transition">{b.title}</div>
              <div className="text-[10px] text-muted-foreground mt-1">{b.author}</div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-[9px] uppercase tracking-widest text-muted-foreground">{b.category}</span>
                <span className={`text-[10px] font-mono ${b.available_copies > 0 ? "text-primary" : "text-muted-foreground"}`}>
                  {b.available_copies}/{b.quantity}
                </span>
              </div>
            </Link>
            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditing(b);
                  setOpen(true);
                }}
                className="p-1.5 rounded bg-secondary/80 hover:bg-primary hover:text-primary-foreground"
                aria-label="Edit"
              >
                <Pencil className="w-3 h-3" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Remove "${b.title}" from catalog?`)) del.mutate(b.id);
                }}
                className="p-1.5 rounded bg-secondary/80 hover:bg-destructive hover:text-destructive-foreground"
                aria-label="Delete"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <BookFormDialog open={open} onOpenChange={setOpen} initial={editing} />
    </div>
  );
}
