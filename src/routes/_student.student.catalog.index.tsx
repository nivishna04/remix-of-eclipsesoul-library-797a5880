import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search } from "lucide-react";
import { BookCover } from "@/components/BookCover";

export const Route = createFileRoute("/_student/student/catalog/")({
  head: () => ({ meta: [{ title: "Catalog — Eclipsesoul" }] }),
  component: StudentCatalog,
});

function StudentCatalog() {
  const [q, setQ] = useState("");
  const { data: books } = useQuery({
    queryKey: ["books-all-student"],
    queryFn: async () => (await supabase.from("books").select("*").order("title")).data ?? [],
  });
  const filtered = books?.filter(
    (b) => !q || [b.title, b.author, b.isbn, b.category].some((f) => f?.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Catalog</h1>
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground mt-2">Browse · Reserve · Renew</p>
      </div>
      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search the stacks..."
          className="w-full pl-9 pr-3 py-2 bg-input border border-border rounded-md text-sm focus:outline-none focus:border-primary"
        />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        {filtered?.map((b) => (
          <Link
            key={b.id}
            to="/student/catalog/$id"
            params={{ id: b.id }}
            className="card-surface card-hover hover:card-hover-on rounded-lg p-3 block group"
          >
            <BookCover src={b.cover_url} alt={b.title} className="aspect-[2/3] rounded mb-3" />
            <div className="text-xs font-medium line-clamp-2 group-hover:text-primary transition">{b.title}</div>
            <div className="text-[10px] text-muted-foreground mt-1">{b.author}</div>
            <div className={`text-[10px] font-mono mt-2 ${b.available_copies > 0 ? "text-primary" : "text-muted-foreground"}`}>
              {b.available_copies > 0 ? `${b.available_copies} available` : "All issued"}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
