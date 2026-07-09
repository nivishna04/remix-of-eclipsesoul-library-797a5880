import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen, BookMarked, Bookmark, AlertCircle, Armchair } from "lucide-react";

export const Route = createFileRoute("/_student/student/")({
  head: () => ({ meta: [{ title: "My Library — Eclipsesoul" }] }),
  component: StudentDashboard,
});

function StudentDashboard() {
  const { data: books } = useQuery({
    queryKey: ["catalog-preview"],
    queryFn: async () => {
      const { data } = await supabase.from("books").select("id,title,author,cover_url,category").limit(6);
      return data ?? [];
    },
  });

  const { data: mine } = useQuery({
    queryKey: ["my-tx"],
    queryFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return { issued: 0, fines: 0, reservations: 0 };
      const [tx, res] = await Promise.all([
        supabase.from("transactions").select("status,fine_amount,fine_paid").eq("student_id", user.user.id),
        supabase.from("reservations").select("status").eq("student_id", user.user.id).eq("status", "pending"),
      ]);
      const issued = tx.data?.filter((t) => t.status === "issued").length ?? 0;
      const fines = tx.data?.filter((t) => !t.fine_paid).reduce((s, t) => s + Number(t.fine_amount ?? 0), 0) ?? 0;
      return { issued, fines, reservations: res.data?.length ?? 0 };
    },
  });

  const cards = [
    { label: "Issued Books", value: mine?.issued ?? 0, icon: BookMarked },
    { label: "Reservations", value: mine?.reservations ?? 0, icon: Bookmark },
    { label: "Pending Fines", value: `₹${mine?.fines?.toFixed(0) ?? 0}`, icon: AlertCircle, danger: true },
    { label: "Catalog", value: books?.length ?? "—", icon: BookOpen, sub: "browse" },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Welcome back</h1>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground mt-2">Student Portal</p>
        </div>
        <Link
          to="/student/seats"
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-md px-4 py-2.5 text-xs uppercase tracking-[0.3em] neon-glow hover:bg-primary/90 transition"
        >
          <Armchair className="w-4 h-4" /> Reserve a Seat
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map(({ label, value, icon: Icon, danger }) => (
          <div key={label} className={`card-surface card-hover hover:card-hover-on rounded-lg p-5 ${danger ? "border-primary/40" : ""}`}>
            <div className="flex items-start justify-between mb-4">
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
              <Icon className={`w-4 h-4 ${danger ? "text-primary" : "text-muted-foreground"}`} />
            </div>
            <div className={`text-3xl font-bold ${danger ? "text-primary" : "text-foreground"}`}>{value}</div>
          </div>
        ))}
      </div>

      <div>
        <h2 className="text-sm font-semibold tracking-widest uppercase text-primary mb-4">⚡ Featured in the Stacks</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {books?.map((b) => (
            <div key={b.id} className="card-surface card-hover hover:card-hover-on rounded-lg p-3">
              <div className="aspect-[2/3] rounded bg-secondary overflow-hidden mb-3">
                {b.cover_url && <img src={b.cover_url} alt={b.title} className="w-full h-full object-cover" loading="lazy" />}
              </div>
              <div className="text-xs font-medium line-clamp-2">{b.title}</div>
              <div className="text-[10px] text-muted-foreground mt-1">{b.author}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
