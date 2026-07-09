import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAdminStats } from "@/lib/library.functions";
import { BookOpen, BookMarked, BookCheck, Users, AlertTriangle, DollarSign, TrendingUp, Bookmark } from "lucide-react";

export const Route = createFileRoute("/_admin/admin/")({
  head: () => ({ meta: [{ title: "Control Room — Eclipsesoul" }] }),
  component: AdminDashboard,
});

function AdminDashboard() {
  const fetchStats = useServerFn(getAdminStats);
  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => fetchStats(),
  });

  const cards = [
    { label: "Total Books", value: stats?.totalTitles ?? 0, sub: "unique titles", icon: BookOpen },
    { label: "Available", value: stats?.available ?? 0, sub: "ready to issue", icon: BookCheck },
    { label: "Issued", value: stats?.issued ?? 0, sub: "currently out", icon: BookMarked },
    { label: "Students", value: stats?.students ?? 0, sub: "registered", icon: Users },
    { label: "Overdue", value: stats?.overdue ?? 0, sub: "need attention", icon: AlertTriangle, danger: true },
    { label: "Reservations", value: stats?.reservations ?? 0, sub: "pending", icon: Bookmark },
    { label: "Total Copies", value: stats?.totalCopies ?? 0, sub: "all editions", icon: TrendingUp },
    { label: "Fines Collected", value: `₹${stats?.finesCollected.toFixed(0) ?? 0}`, sub: "all time", icon: DollarSign, danger: true },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Control Room</h1>
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground mt-2">
          Library Operations Dashboard
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map(({ label, value, sub, icon: Icon, danger }) => (
          <div
            key={label}
            className={`card-surface card-hover hover:card-hover-on rounded-lg p-5 ${
              danger ? "border-primary/40" : ""
            }`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                {label}
              </div>
              <div className={`w-9 h-9 rounded-md flex items-center justify-center ${
                danger ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"
              }`}>
                <Icon className="w-4 h-4" />
              </div>
            </div>
            <div className={`text-3xl font-bold ${danger ? "text-primary" : "text-foreground"}`}>
              {value}
            </div>
            <div className="text-xs text-muted-foreground mt-1">{sub}</div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="card-surface rounded-lg p-6">
          <h3 className="text-sm font-semibold tracking-widest uppercase text-primary mb-4">⚡ Recent Activity</h3>
          <p className="text-sm text-muted-foreground">Activity feed will appear here as the library is used.</p>
        </div>
        <div className="card-surface rounded-lg p-6">
          <h3 className="text-sm font-semibold tracking-widest uppercase text-primary mb-4">⏱ Overdue Books</h3>
          <p className="text-sm text-muted-foreground">
            {stats?.overdue ? `${stats.overdue} book(s) past due date.` : "No overdue books"}
          </p>
        </div>
      </div>
    </div>
  );
}
